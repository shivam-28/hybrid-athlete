import "server-only";
import { addDays } from "@/lib/activities/dates";
import { adjustSession } from "@/lib/coach/adjust";
import { DEFAULT_EASY_PACE_MIN_PER_KM } from "@/lib/coach/guardrails";
import type { PlanSession } from "@/lib/coach/plan-schema";
import { evaluateSignals, parseCheckin, scoreReadiness, type ReadinessResult, type ReadinessScore, type Signal } from "@/lib/coach/readiness";
import type { Tables } from "@/lib/database.types";
import { localDate } from "@/lib/time";
import { trainingOverview } from "@/server/activities/views";
import type { Profile } from "@/server/auth";
import type { Db } from "@/server/body/weights";
import { CoachError } from "./errors";
import { snapshotOf, type PlanRow, type SessionRow } from "./plans";

export type CheckinRow = Tables<"readiness_checkins">;
export type TodaySession = { session: SessionRow; original: PlanSession; proposed: PlanSession | null };
export type TodayCoach = {
  date: string;
  checkin: CheckinRow | null;
  readiness: (ReadinessResult & { signals: Signal[] }) | null;
  sessions: TodaySession[];
  easyPaceMinPerKm: number;
};

async function signalsFor(db: Db, today: string): Promise<Signal[]> {
  const [{ data: rows, error }, overview] = await Promise.all([
    db.from("daily_metrics").select("local_date, sleep_minutes, resting_hr_bpm, hrv_sdnn_ms").gte("local_date", addDays(today, -28)).lte("local_date", today),
    trainingOverview(db, today),
  ]);
  if (error) throw error;
  return evaluateSignals(
    (rows ?? []).map((r) => ({ ...r, hrv_sdnn_ms: r.hrv_sdnn_ms === null ? null : Number(r.hrv_sdnn_ms) })),
    today,
    overview.load.ratio,
  );
}

/** Today's sessions of the active plan (any status) and the active plan itself. */
export async function activeSessionsOn(db: Db, date: string): Promise<{ plan: PlanRow | null; sessions: SessionRow[] }> {
  const { data, error } = await db
    .from("planned_sessions")
    .select("*, training_plans!inner(*)")
    .eq("local_date", date)
    .eq("training_plans.status", "active")
    .order("position");
  if (error) throw error;
  const rows = data ?? [];
  const plan = (rows[0]?.training_plans as PlanRow | undefined) ?? null;
  const sessions = rows.map((r) => {
    const session: Partial<typeof r> = { ...r };
    delete session.training_plans;
    return session as SessionRow;
  });
  return { plan, sessions };
}

export const easyPaceOf = (plan: PlanRow | null) => (plan ? snapshotOf(plan).history?.easyPaceMinPerKm : null) ?? DEFAULT_EASY_PACE_MIN_PER_KM;

function withProposals(sessions: SessionRow[], score: ReadinessScore | null, pace: number): TodaySession[] {
  return sessions.map((session) => {
    const original = session.details as PlanSession;
    const proposed = score && session.status === "planned" ? adjustSession(original, score, pace) : null;
    return { session, original, proposed };
  });
}

export async function loadTodayCoach(db: Db, profile: Profile, now = new Date()): Promise<TodayCoach> {
  const today = localDate(now, profile.timezone);
  const [{ data: checkin }, { plan, sessions }] = await Promise.all([
    db.from("readiness_checkins").select("*").eq("local_date", today).maybeSingle(),
    activeSessionsOn(db, today),
  ]);
  const pace = easyPaceOf(plan);
  const readiness = checkin
    ? {
        score: checkin.score as ReadinessScore,
        reasons: checkin.reasons as string[],
        notes: ((checkin.signals as Signal[]) ?? []).filter((s) => s.status === "note").map((s) => s.reason),
        referral: checkin.pain_flag ? scoreReadiness(checkin, []).referral : null,
        mean: (checkin.sleep_quality + checkin.soreness + checkin.energy + checkin.stress) / 4,
        signals: checkin.signals as Signal[],
      }
    : null;
  return { date: today, checkin, readiness, sessions: withProposals(sessions, readiness?.score ?? null, pace), easyPaceMinPerKm: pace };
}

/** One check-in per local date; resubmitting replaces it and resets any adjustment choice. No AI involved. */
export async function submitCheckin(db: Db, profile: Profile, input: unknown, now = new Date()): Promise<TodayCoach> {
  const parsed = parseCheckin(input);
  if (!parsed.success) throw new CoachError("invalid", "Each answer must be between 1 and 5.", parsed.fieldErrors);
  const today = localDate(now, profile.timezone);
  const signals = await signalsFor(db, today);
  const result = scoreReadiness(parsed.data, signals);

  const { error } = await db.from("readiness_checkins").upsert(
    {
      local_date: today,
      occurred_at: now.toISOString(),
      ...parsed.data,
      score: result.score,
      reasons: result.reasons as never,
      signals: signals as never,
      adjustment_choice: "none",
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) throw error;
  const { sessions } = await activeSessionsOn(db, today);
  const open = sessions.filter((s) => s.status === "planned" && s.adjusted_details !== null).map((s) => s.id);
  if (open.length > 0) await db.from("planned_sessions").update({ adjusted_details: null }).in("id", open);
  return loadTodayCoach(db, profile, now);
}

/** Accept the proposed adjustment (stored as adjusted_details) or keep the original (override recorded). */
export async function chooseAdjustment(db: Db, profile: Profile, choice: "accepted" | "overridden", now = new Date()): Promise<TodayCoach> {
  const today = localDate(now, profile.timezone);
  const coach = await loadTodayCoach(db, profile, now);
  if (!coach.checkin) throw new CoachError("invalid", "Do today's check-in first.");
  for (const { session, proposed } of coach.sessions) {
    if (session.status !== "planned") continue;
    const adjusted = choice === "accepted" ? proposed : null;
    const { error } = await db.from("planned_sessions").update({ adjusted_details: adjusted as never }).eq("id", session.id);
    if (error) throw error;
  }
  const { error } = await db.from("readiness_checkins").update({ adjustment_choice: choice }).eq("local_date", today);
  if (error) throw error;
  return loadTodayCoach(db, profile, now);
}
