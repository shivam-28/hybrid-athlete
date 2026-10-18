import "server-only";
import { z } from "zod";
import { addDays } from "@/lib/activities/dates";
import { guardrailContextFrom } from "@/lib/coach/context";
import { validatePlan, type GuardrailContext, type Violation } from "@/lib/coach/guardrails";
import { planFromRows, sessionDetails } from "@/lib/coach/plan-rows";
import { PlanSessionSchema, type WeekPlan } from "@/lib/coach/plan-schema";
import type { Tables } from "@/lib/database.types";
import type { Db } from "@/server/body/weights";
import { CoachError } from "./errors";
import type { PlanSnapshot } from "./generate";

export type PlanRow = Tables<"training_plans">;
export type SessionRow = Tables<"planned_sessions">;
export type PlanWithSessions = { plan: PlanRow; sessions: SessionRow[]; weekPlan: WeekPlan; warnings: Violation[]; guardrails: GuardrailContext };

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export const snapshotOf = (plan: PlanRow) => plan.context_snapshot as unknown as PlanSnapshot;
export const guardrailsFor = (plan: PlanRow) => {
  const snapshot = snapshotOf(plan);
  return guardrailContextFrom(snapshot, snapshot.exerciseMuscles ?? {});
};

async function loadSessions(db: Db, planId: string): Promise<SessionRow[]> {
  const { data, error } = await db.from("planned_sessions").select("*").eq("plan_id", planId).order("day_index").order("position");
  if (error) throw error;
  return data;
}

function assemble(plan: PlanRow, sessions: SessionRow[]): PlanWithSessions {
  const weekPlan = planFromRows(sessions);
  const guardrails = guardrailsFor(plan);
  return { plan, sessions, weekPlan, warnings: validatePlan(weekPlan, guardrails), guardrails };
}

export async function getPlan(db: Db, planId: string): Promise<PlanWithSessions> {
  const { data: plan } = isUuid(planId) ? await db.from("training_plans").select("*").eq("id", planId).maybeSingle() : { data: null };
  if (!plan) throw new CoachError("not_found", "Plan not found.");
  return assemble(plan, await loadSessions(db, plan.id));
}

/** The plan to show for a week: the active one, else the newest draft. */
export async function getPlanForWeek(db: Db, weekStart: string): Promise<PlanWithSessions | null> {
  const { data } = await db
    .from("training_plans")
    .select("*")
    .eq("week_start", weekStart)
    .in("status", ["active", "draft"])
    .order("status") // 'active' < 'draft'
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? assemble(data, await loadSessions(db, data.id)) : null;
}

export async function listPlanHistory(db: Db, limit = 30): Promise<PlanRow[]> {
  const { data, error } = await db.from("training_plans").select("*").order("week_start", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

async function refreshWarnings(db: Db, planId: string): Promise<PlanWithSessions> {
  const result = await getPlan(db, planId);
  const changed = JSON.stringify(result.warnings) !== JSON.stringify(result.plan.warnings);
  if (changed) {
    const { error } = await db
      .from("training_plans")
      .update({ warnings: result.warnings as never, acknowledged_warnings: false })
      .eq("id", planId);
    if (error) throw error;
    return { ...result, plan: { ...result.plan, warnings: result.warnings as never, acknowledged_warnings: false } };
  }
  return result;
}

async function requireEditableSession(db: Db, sessionId: string): Promise<{ session: SessionRow; plan: PlanRow }> {
  const { data: session } = isUuid(sessionId) ? await db.from("planned_sessions").select("*").eq("id", sessionId).maybeSingle() : { data: null };
  if (!session) throw new CoachError("not_found", "Session not found.");
  const { data: plan } = await db.from("training_plans").select("*").eq("id", session.plan_id).single();
  if (!plan || plan.status === "superseded") throw new CoachError("invalid", "This plan was replaced and can no longer be edited.");
  return { session, plan: plan! };
}

const editSchema = z.object({ day_index: z.number().int().min(0).max(6).optional(), details: z.unknown().optional() });

/** Edit a session's type/details and/or move it to another day; guardrails are re-evaluated (spec "Review, edit and accept"). */
export async function editSession(db: Db, sessionId: string, input: unknown): Promise<PlanWithSessions> {
  const patch = editSchema.parse(input);
  const { session, plan } = await requireEditableSession(db, sessionId);
  const update: Partial<SessionRow> = {};
  if (patch.details !== undefined) {
    const parsed = PlanSessionSchema.safeParse(patch.details);
    if (!parsed.success) throw new CoachError("invalid", parsed.error.issues[0]?.message ?? "Invalid session.");
    update.type = parsed.data.type;
    update.details = sessionDetails(parsed.data) as never;
    update.adjusted_details = null;
  }
  if (patch.day_index !== undefined && patch.day_index !== session.day_index) {
    update.day_index = patch.day_index;
    update.local_date = addDays(plan.week_start, patch.day_index);
    update.position = 99;
  }
  const { error } = await db.from("planned_sessions").update(update).eq("id", sessionId);
  if (error) throw error;
  return refreshWarnings(db, plan.id);
}

export async function deleteSession(db: Db, sessionId: string): Promise<PlanWithSessions> {
  const { plan } = await requireEditableSession(db, sessionId);
  const { error } = await db.from("planned_sessions").delete().eq("id", sessionId);
  if (error) throw error;
  return refreshWarnings(db, plan.id);
}

/** Server-side re-validation, explicit acknowledgement of remaining warnings, then the atomic swap. */
export async function acceptPlan(db: Db, planId: string, acknowledged: boolean): Promise<PlanWithSessions> {
  const current = await refreshWarnings(db, planId);
  if (current.plan.status === "superseded") throw new CoachError("invalid", "This plan was replaced by a newer one.");
  if (current.warnings.length > 0 && !acknowledged) {
    throw new CoachError("warnings_unacknowledged", "Review and acknowledge the warnings before accepting.", current.warnings);
  }
  const ack = await db.from("training_plans").update({ acknowledged_warnings: acknowledged || current.warnings.length === 0 }).eq("id", planId);
  if (ack.error) throw ack.error;
  const { error } = await db.rpc("accept_training_plan", { p_plan_id: planId });
  if (error) throw new CoachError("invalid", "The plan could not be accepted.");
  return getPlan(db, planId);
}
