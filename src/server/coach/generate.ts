import "server-only";
import { randomUUID } from "node:crypto";
import { addDays } from "@/lib/activities/dates";
import { buildPlanContext, guardrailContextFrom, type HistorySet, type PlanContext } from "@/lib/coach/context";
import { validatePlan, type Violation } from "@/lib/coach/guardrails";
import { ModelWeekPlanSchema, modelPlanToWeekPlan, type ModelWeekPlan, type WeekPlan } from "@/lib/coach/plan-schema";
import { sessionDetails } from "@/lib/coach/plan-rows";
import { isoWeekStart, localDate } from "@/lib/time";
import { withUserAnthropic } from "@/server/ai/client";
import { parseStructured, type StructuredClient } from "@/server/ai/structured";
import type { Profile } from "@/server/auth";
import { getGoalState } from "@/server/body/read";
import type { Db } from "@/server/body/weights";
import { mapCoachAiError } from "./ai-errors";
import { CoachError } from "./errors";
import { loadOfferedExercises } from "./library";
import { getPreferences } from "./preferences";
import { PLAN_SYSTEM_PROMPT, planUserPrompt, repairPrompt } from "./prompt";

export type RunAi = <T>(call: (client: StructuredClient) => Promise<T>) => Promise<T>;

/** Stored on the plan: what the model saw plus the exercise → muscle map the client-side validator needs. */
export type PlanSnapshot = PlanContext & { exerciseMuscles: Record<string, string[]> };
export type GenerateResult = { planId: string; plan: WeekPlan; warnings: Violation[]; snapshot: PlanSnapshot };

const MAX_TOKENS = 16000;

type Attempt = { raw: ModelWeekPlan | null; plan: WeekPlan | null; problems: string[]; violations: Violation[] };

async function loadHistory(db: Db, weekStart: string) {
  const from = addDays(weekStart, -28);
  const to = addDays(weekStart, -1);
  const [activities, sets] = await Promise.all([
    db.from("activities").select("id, local_date, sport, distance_m, moving_s, elapsed_s").gte("local_date", from).lte("local_date", to),
    db
      .from("workout_sets")
      .select("local_date, session_id, set_type, exercise_id, exercises(exercise_muscles(muscle_group, role))")
      .gte("local_date", from)
      .lte("local_date", to),
  ]);
  if (activities.error) throw activities.error;
  if (sets.error) throw sets.error;
  const historySets: HistorySet[] = (sets.data ?? []).map((s) => ({
    local_date: s.local_date,
    session_id: s.session_id,
    set_type: s.set_type,
    muscles: (s.exercises?.exercise_muscles ?? []) as HistorySet["muscles"],
  }));
  return {
    activities: (activities.data ?? []).map((a) => ({ ...a, distance_m: a.distance_m === null ? null : Number(a.distance_m) })),
    sets: historySets,
    recentIds: new Set((sets.data ?? []).map((s) => s.exercise_id)),
  };
}

/**
 * Design D1/D3/D9: build context → one structured call → strict schema + closed exercise
 * set + guardrails → at most one repair → persist as a draft (with warnings if still violating).
 * Structurally invalid output after the repair is never saved.
 */
export async function generatePlan(
  db: Db,
  profile: Profile,
  weekStart: string,
  runAi: RunAi = (call) => withUserAnthropic(profile.user_id, call),
  now = new Date(),
): Promise<GenerateResult> {
  if (isoWeekStart(weekStart) !== weekStart) throw new CoachError("invalid", "Plans start on a Monday.");
  const preferences = await getPreferences(db);
  if (!preferences) throw new CoachError("no_preferences", "Set your training preferences first.");

  const [history, goal] = await Promise.all([loadHistory(db, weekStart), getGoalState(db, profile, localDate(now, profile.timezone))]);
  const beginner = profile.strength_experience === "beginner" || profile.running_experience === "beginner";
  const offered = await loadOfferedExercises(db, { equipment: preferences.equipment, beginner, recentIds: history.recentIds });
  const context = buildPlanContext({
    weekStart,
    preferences,
    experience: { strength: profile.strength_experience, running: profile.running_experience },
    goalPhase: goal.state?.phase ?? null,
    activities: history.activities,
    sets: history.sets,
  });
  const guardrails = guardrailContextFrom(context, offered.muscles);

  const evaluate = (raw: ModelWeekPlan | null): Attempt => {
    if (!raw) return { raw, plan: null, problems: ["The response was not a readable plan."], violations: [] };
    const mapped = modelPlanToWeekPlan(raw, offered.refs);
    if (!mapped.ok) return { raw, plan: null, problems: mapped.errors, violations: [] };
    const violations = validatePlan(mapped.plan, guardrails);
    return { raw, plan: mapped.plan, problems: violations.map((v) => v.message), violations };
  };

  const prompt = planUserPrompt(context, offered.promptLines);
  const call = (text: string) =>
    runAi((client) =>
      parseStructured(client, { system: PLAN_SYSTEM_PROMPT, content: [{ type: "text", text }], schema: ModelWeekPlanSchema, maxTokens: MAX_TOKENS }),
    );

  let attempt: Attempt;
  try {
    attempt = evaluate(await call(prompt));
    if (attempt.problems.length > 0) {
      attempt = evaluate(await call(`${prompt}\n\n${repairPrompt(attempt.raw, attempt.problems)}`));
    }
  } catch (error) {
    mapCoachAiError(error, "Plan generation");
  }
  if (!attempt.plan) throw new CoachError("plan_invalid", "The coach couldn't produce a valid plan. Please try again.");

  // Ids first, so stored warnings point at real planned_sessions rows.
  const plan: WeekPlan = {
    days: attempt.plan.days.map((d) => ({
      sessions: (d.sessions.length > 0 ? d.sessions : [{ type: "rest" as const }]).map((s) => ({ ...s, id: randomUUID() })),
    })),
  };
  const warnings = validatePlan(plan, guardrails);
  const snapshot: PlanSnapshot = { ...context, exerciseMuscles: offered.muscles };
  const planId = await persistDraft(db, { weekStart, plan, warnings, snapshot, today: localDate(now, profile.timezone), now });
  return { planId, plan, warnings, snapshot };
}

async function persistDraft(
  db: Db,
  input: { weekStart: string; plan: WeekPlan; warnings: Violation[]; snapshot: PlanSnapshot; today: string; now: Date },
): Promise<string> {
  await db.from("training_plans").delete().eq("week_start", input.weekStart).eq("status", "draft");
  const { data: row, error } = await db
    .from("training_plans")
    .insert({
      occurred_at: input.now.toISOString(),
      local_date: input.today,
      week_start: input.weekStart,
      phase: input.snapshot.phase,
      context_snapshot: input.snapshot as never,
      warnings: input.warnings as never,
    })
    .select("id")
    .single();
  if (error) throw error;

  const sessions = input.plan.days.flatMap((d, day) =>
    d.sessions.map((s, position) => ({
      id: s.id!,
      plan_id: row.id,
      local_date: addDays(input.weekStart, day),
      day_index: day,
      position,
      type: s.type,
      details: sessionDetails(s) as never,
    })),
  );
  const inserted = await db.from("planned_sessions").insert(sessions);
  if (inserted.error) {
    await db.from("training_plans").delete().eq("id", row.id);
    throw inserted.error;
  }
  return row.id;
}
