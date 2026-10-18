import "server-only";
import type { Json } from "@/lib/database.types";
import { addDays, daysBetween } from "@/lib/activities/dates";
import { SPORT_LABELS } from "@/lib/activities/format";
import { trendSeries } from "@/lib/body/trend";
import {
  computeDailyTargets,
  exerciseEnergy,
  type ActivityInput,
  type Lifestyle,
  type StrengthSessionInput,
  type TargetInputs,
  type TargetsResult,
} from "@/lib/nutrition/targets";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { plannedEnergyInput } from "@/lib/coach/energy";
import { getGoalState } from "@/server/body/read";
import { activeSessionsOn, easyPaceOf } from "@/server/coach/readiness";
import { listDailyWeights, type Db } from "@/server/body/weights";

const WINDOW_DAYS = 28;
const OPEN_SESSION_MAX_MS = 3 * 3_600_000;

type ActivityRow = { id: string; sport: string; occurred_at: string; local_date: string; elapsed_s: number | null; moving_s: number | null; distance_m: number | null; calories_kcal: number | null };
type SessionRow = { id: string; occurred_at: string; finished_at: string | null; local_date: string };

function toActivityInput(a: ActivityRow): ActivityInput {
  const sport = SPORT_LABELS[a.sport] ?? a.sport;
  const distance = a.distance_m ? ` ${(Number(a.distance_m) / 1000).toFixed(1)} km` : "";
  return {
    id: a.id,
    sport: a.sport,
    label: `${sport}${distance}`,
    startedAt: a.occurred_at,
    durationS: a.moving_s ?? a.elapsed_s ?? 0,
    activeKcal: a.calories_kcal === null ? null : Number(a.calories_kcal),
  };
}

/** Open sessions count until now, capped at 3 h (a forgotten "finish" shouldn't inflate targets). */
function toSessionInput(s: SessionRow, now: Date): StrengthSessionInput {
  const start = Date.parse(s.occurred_at);
  const end = s.finished_at ? Date.parse(s.finished_at) : Math.min(now.getTime(), start + OPEN_SESSION_MAX_MS);
  return { id: s.id, startedAt: s.occurred_at, endedAt: new Date(Math.max(start, end)).toISOString() };
}

/** Assembles the pure engine's inputs for one local day from the user's own (RLS) data. */
export async function loadTargetInputs(db: Db, profile: Profile, date: string, now = new Date()): Promise<TargetInputs> {
  const windowStart = addDays(date, -WINDOW_DAYS);
  const windowEnd = addDays(date, -1);

  const [weights, bodyFat, goal, activities, sessions, logDays] = await Promise.all([
    listDailyWeights(db),
    db
      .from("body_composition_tests")
      .select("local_date, body_fat_pct")
      .not("body_fat_pct", "is", null)
      .lte("local_date", date)
      .order("local_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getGoalState(db, profile, date),
    db
      .from("activities")
      .select("id, sport, occurred_at, local_date, elapsed_s, moving_s, distance_m, calories_kcal")
      .gte("local_date", windowStart)
      .lte("local_date", date),
    db.from("workout_sessions").select("id, occurred_at, finished_at, local_date").gte("local_date", windowStart).lte("local_date", date),
    db.from("food_log_days").select("local_date").eq("is_complete", true).gte("local_date", windowStart).lte("local_date", windowEnd),
  ]);
  for (const r of [bodyFat, activities, sessions, logDays]) if (r.error) throw r.error;

  const series = trendSeries(
    weights.filter((w) => w.date <= date).map((w) => ({ date: w.date, weightKg: w.weightKg })),
    date,
  );
  const trendOn = (d: string) => series.filter((p) => p.date <= d).at(-1) ?? null;
  const trendWeightKg = trendOn(date)?.trendKg ?? null;

  const completeDates = (logDays.data ?? []).map((d) => d.local_date);
  let meanIntakeKcal: number | null = null;
  if (completeDates.length > 0) {
    const { data: meals, error } = await db.from("meals").select("local_date, meal_items(kcal)").in("local_date", completeDates);
    if (error) throw error;
    const total = (meals ?? []).reduce((sum, m) => sum + m.meal_items.reduce((s, i) => s + Number(i.kcal), 0), 0);
    meanIntakeKcal = total / completeDates.length;
  }

  // Window trend change, per day, from the day before the window (or the first trend point) to yesterday.
  const end = trendOn(windowEnd);
  const startPoint = series.find((p) => p.date >= addDays(windowStart, -1)) ?? null;
  const span = end && startPoint ? daysBetween(startPoint.date, end.date) : 0;
  const trendChangeKgPerDay = end && startPoint && span > 0 ? (end.trendKg - startPoint.trendKg) / span : null;

  const allActivities = (activities.data ?? []) as ActivityRow[];
  const allSessions = (sessions.data ?? []) as SessionRow[];
  const forDay = (d: string) => ({
    activities: allActivities.filter((a) => a.local_date === d).map(toActivityInput),
    sessions: allSessions.filter((s) => s.local_date === d).map((s) => toSessionInput(s, now)),
  });
  let windowExercise = 0;
  if (trendWeightKg !== null) {
    for (let d = windowStart; d <= windowEnd; d = addDays(d, 1)) {
      const day = forDay(d);
      windowExercise += exerciseEnergy(day.activities, day.sessions, trendWeightKg).totalKcal;
    }
  }

  const today = forDay(date);
  // Planned training counts before it happens (add-coach); past days only count what was recorded.
  const planned = date >= localDate(now, profile.timezone) && trendWeightKg !== null ? await activeSessionsOn(db, date) : null;
  const plannedSessions = planned
    ? planned.sessions.flatMap((s) => plannedEnergyInput(s, trendWeightKg!, easyPaceOf(planned.plan)) ?? [])
    : [];
  return {
    date,
    profile: {
      sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : null,
      birthDate: profile.birth_date,
      heightCm: profile.height_cm === null ? null : Number(profile.height_cm),
      lifestyle: profile.lifestyle_level as Lifestyle,
    },
    trendWeightKg,
    bodyFat: bodyFat.data ? { pct: Number(bodyFat.data.body_fat_pct), measuredOn: bodyFat.data.local_date } : null,
    goal: goal.state
      ? { phase: goal.state.phase, rateKgPerWeek: goal.state.targetRateKgPerWeek, goalWeightKg: goal.state.goalWeightKg }
      : null,
    activities: today.activities,
    strengthSessions: today.sessions,
    plannedSessions,
    adaptive: {
      completeDays: completeDates.length,
      weighIns: weights.filter((w) => w.date >= windowStart && w.date <= windowEnd).length,
      meanIntakeKcal,
      trendChangeKgPerDay,
      meanExerciseKcal: windowExercise / WINDOW_DAYS,
    },
  };
}

export type DayTargets = { date: string; frozen: boolean; result: TargetsResult };

type StoredResult = Extract<TargetsResult, { ok: true }>;

/**
 * Design D3: today is computed on every read and upserted; a past day is
 * returned as stored, or computed once from current data and then frozen.
 * Future days are computed but never stored.
 */
export async function getTargetsForDate(db: Db, profile: Profile, date: string, now = new Date()): Promise<DayTargets> {
  const today = localDate(now, profile.timezone);
  if (date < today) {
    const { data } = await db.from("daily_nutrition_targets").select("targets, components").eq("local_date", date).maybeSingle();
    if (data) {
      const stored = data.targets as unknown as Omit<StoredResult, "components">;
      return { date, frozen: true, result: { ...stored, components: data.components as unknown as StoredResult["components"] } };
    }
  }

  const result = computeDailyTargets(await loadTargetInputs(db, profile, date, now));
  if (!result.ok || date > today) return { date, frozen: false, result };

  const { components, ...rest } = result;
  const row = {
    local_date: date,
    targets: rest as unknown as NonNullable<Json>,
    components: components as unknown as NonNullable<Json>,
    method: result.info.expenditureMethod,
    computed_at: now.toISOString(),
  };
  if (date === today) {
    const { error } = await db.from("daily_nutrition_targets").upsert(row, { onConflict: "user_id,local_date" });
    if (error) throw error;
  } else {
    // A concurrent first read may have frozen the day already; keep whichever landed first.
    const { error } = await db.from("daily_nutrition_targets").upsert(row, { onConflict: "user_id,local_date", ignoreDuplicates: true });
    if (error) throw error;
  }
  return { date, frozen: date < today, result };
}

export async function setLogDayComplete(db: Db, date: string, isComplete: boolean): Promise<void> {
  const { error } = await db.from("food_log_days").upsert({ local_date: date, is_complete: isComplete }, { onConflict: "user_id,local_date" });
  if (error) throw error;
}

export async function isLogDayComplete(db: Db, date: string): Promise<boolean> {
  const { data } = await db.from("food_log_days").select("is_complete").eq("local_date", date).maybeSingle();
  return data?.is_complete ?? false;
}
