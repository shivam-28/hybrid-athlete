import "server-only";
import { z } from "zod";
import { addDays } from "@/lib/activities/dates";
import { trendSeries } from "@/lib/body/trend";
import { buildWeeklyReview, type WeeklyReview } from "@/lib/coach/review";
import { isoWeekStart, localDate } from "@/lib/time";
import { withUserAnthropic } from "@/server/ai/client";
import { parseStructured } from "@/server/ai/structured";
import type { Profile } from "@/server/auth";
import { getGoalState } from "@/server/body/read";
import { listDailyWeights, type Db } from "@/server/body/weights";
import { mapCoachAiError } from "./ai-errors";
import { CoachError } from "./errors";
import type { RunAi } from "./generate";
import { easyPaceOf } from "./readiness";
import type { PlanRow, SessionRow } from "./plans";

export async function loadWeeklyReview(db: Db, profile: Profile, weekStart: string, now = new Date()): Promise<WeeklyReview> {
  if (isoWeekStart(weekStart) !== weekStart) throw new CoachError("invalid", "Weeks start on a Monday.");
  const weekEnd = addDays(weekStart, 6);
  const [plan, runs, volume, weights, goal] = await Promise.all([
    db.from("training_plans").select("*, planned_sessions(*)").eq("week_start", weekStart).eq("status", "active").maybeSingle(),
    db.from("activities").select("local_date, distance_m").eq("sport", "running").gte("local_date", weekStart).lte("local_date", weekEnd),
    db.rpc("weekly_muscle_volume", { p_week_start: weekStart }),
    listDailyWeights(db, addDays(weekStart, -60)),
    getGoalState(db, profile, localDate(now, profile.timezone)),
  ]);
  for (const r of [plan, runs, volume]) if (r.error) throw r.error;
  const planRow = plan.data as (PlanRow & { planned_sessions: SessionRow[] }) | null;
  return buildWeeklyReview({
    weekStart,
    sessions: planRow?.planned_sessions ?? [],
    runs: (runs.data ?? []).map((r) => ({ ...r, distance_m: r.distance_m === null ? null : Number(r.distance_m) })),
    muscleSets: (volume.data ?? []).map((v) => ({ muscle_group: v.muscle_group, sets: Number(v.sets) })),
    trend: trendSeries(weights, weekEnd).map((p) => ({ date: p.date, trendKg: p.trendKg })),
    goalPhase: goal.state?.phase ?? null,
    easyPaceMinPerKm: easyPaceOf(planRow),
  });
}

const SUMMARY_SYSTEM = `You are a supportive hybrid-athlete coach writing a short weekly check-in.
Write one paragraph (3–5 sentences) addressed to the athlete. Use only the figures provided; do not invent numbers or events.
Mention adherence, running volume vs plan, strength balance across muscle groups, and the weight trend vs their goal when present.
End with one concrete focus for next week. Give no medical advice or diagnoses.`;

export function reviewFigures(review: WeeklyReview): string {
  const w = review.weight;
  return [
    `Week starting ${review.weekStart}.`,
    review.adherencePct === null
      ? "No accepted plan this week."
      : `Sessions: ${review.completedSessions} of ${review.plannedSessions} planned completed (${review.adherencePct}%), ${review.skippedSessions} skipped, ${review.missedSessions} not done.`,
    `Running: ${review.runKm} km done vs ${review.plannedRunKm} km planned.`,
    `Working sets per muscle group: ${Object.entries(review.setsPerMuscle).map(([m, n]) => `${m} ${n}`).join(", ")}.`,
    w
      ? `Weight trend: ${w.startKg} → ${w.endKg} kg (${w.changeKg > 0 ? "+" : ""}${w.changeKg} kg); goal direction ${w.goalDirection ?? "none set"}${w.onTrack === null ? "" : w.onTrack ? ", on track" : ", off track"}.`
      : "Weight trend: not enough weigh-ins.",
  ].join("\n");
}

/** Optional AI paragraph grounded only in the computed figures; not stored (design D10). */
export async function summarizeWeek(
  db: Db,
  profile: Profile,
  weekStart: string,
  runAi: RunAi = (call) => withUserAnthropic(profile.user_id, call),
): Promise<{ summary: string }> {
  const review = await loadWeeklyReview(db, profile, weekStart);
  try {
    const result = await runAi((client) =>
      parseStructured(client, {
        system: SUMMARY_SYSTEM,
        content: [{ type: "text", text: reviewFigures(review) }],
        schema: z.object({ summary: z.string() }),
        maxTokens: 2000,
      }),
    );
    if (!result) throw new CoachError("ai_unavailable", "The summary isn't available right now. Please try again.");
    return result;
  } catch (error) {
    if (error instanceof CoachError) throw error;
    mapCoachAiError(error, "The weekly summary");
  }
}
