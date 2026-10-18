import { addDays } from "@/lib/activities/dates";
import type { GoalPhase } from "@/lib/body/goals";
import { DEFAULT_EASY_PACE_MIN_PER_KM, type GuardrailContext } from "./guardrails";
import { derivePhase, weeksToRace, type TrainingPhase } from "./phase";
import type { TrainingPreferences } from "./preferences";

export type HistoryActivity = { id: string; local_date: string; sport: string; distance_m: number | null; moving_s: number | null; elapsed_s: number | null };
export type HistorySet = { local_date: string; session_id: string; set_type: string; muscles: { muscle_group: string; role: "primary" | "secondary" }[] };

/** Compact, aggregate-only summary sent to the model and snapshotted on the plan (design D4). */
export type PlanContext = {
  weekStart: string;
  phase: TrainingPhase;
  weeksToRace: number | null;
  race: { distanceKm: number; date: string; goalTime: string | null } | null;
  preferences: { daysPerWeek: number; maxSessionMin: number; longRunWeekday: number; equipment: "gym" | "home" };
  experience: { strength: string; running: string };
  goalPhase: GoalPhase | null;
  history: {
    weeklyRunKm: number[];
    avgWeeklyRunKm: number;
    longestRunKm: number;
    runsPerWeek: number;
    easyPaceMinPerKm: number | null;
    strengthSessionsPerWeek: number;
    workingSetsPerMuscleWeek: Record<string, number>;
  };
};

const HISTORY_WEEKS = 4;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildPlanContext(input: {
  weekStart: string;
  preferences: TrainingPreferences;
  experience: { strength: string; running: string };
  goalPhase: GoalPhase | null;
  /** Rows in the 4 weeks before weekStart (others are ignored). */
  activities: HistoryActivity[];
  sets: HistorySet[];
}): PlanContext {
  const { weekStart, preferences: p } = input;
  const from = addDays(weekStart, -HISTORY_WEEKS * 7);
  const inWindow = (d: string) => d >= from && d < weekStart;

  const runs = input.activities.filter((a) => a.sport === "running" && inWindow(a.local_date));
  const weeklyRunKm = Array.from({ length: HISTORY_WEEKS }, (_, i) => {
    const start = addDays(from, i * 7);
    const end = addDays(start, 6);
    return round1(runs.filter((r) => r.local_date >= start && r.local_date <= end).reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0));
  });
  const paces = runs
    .filter((r) => (r.distance_m ?? 0) >= 1000 && (r.moving_s ?? r.elapsed_s))
    .map((r) => (r.moving_s ?? r.elapsed_s)! / 60 / ((r.distance_m ?? 0) / 1000));

  const working = input.sets.filter((s) => inWindow(s.local_date) && s.set_type !== "warmup");
  const setsPerMuscle: Record<string, number> = {};
  for (const s of working) {
    for (const m of s.muscles) setsPerMuscle[m.muscle_group] = (setsPerMuscle[m.muscle_group] ?? 0) + (m.role === "primary" ? 1 : 0.5);
  }

  const raceDate = p.race_date && p.race_date >= weekStart ? p.race_date : null;
  const easyPace = median(paces);
  return {
    weekStart,
    phase: derivePhase(raceDate, weekStart),
    weeksToRace: raceDate ? weeksToRace(raceDate, weekStart) : null,
    race: raceDate && p.race_distance_km ? { distanceKm: p.race_distance_km, date: raceDate, goalTime: p.race_goal_time } : null,
    preferences: { daysPerWeek: p.days_per_week, maxSessionMin: p.max_session_min, longRunWeekday: p.long_run_weekday, equipment: p.equipment },
    experience: input.experience,
    goalPhase: input.goalPhase,
    history: {
      weeklyRunKm,
      avgWeeklyRunKm: round1(weeklyRunKm.reduce((s, k) => s + k, 0) / HISTORY_WEEKS),
      longestRunKm: round1(Math.max(0, ...runs.map((r) => (r.distance_m ?? 0) / 1000))),
      runsPerWeek: round2(runs.length / HISTORY_WEEKS),
      easyPaceMinPerKm: easyPace === null ? null : round2(easyPace),
      strengthSessionsPerWeek: round2(new Set(working.map((s) => s.session_id)).size / HISTORY_WEEKS),
      workingSetsPerMuscleWeek: Object.fromEntries(Object.entries(setsPerMuscle).map(([m, n]) => [m, round2(n / HISTORY_WEEKS)])),
    },
  };
}

/** The guardrail baseline is exactly what the model saw (design D4). */
export function guardrailContextFrom(ctx: PlanContext, exerciseMuscles: Record<string, string[]>): GuardrailContext {
  return {
    prevAvgWeeklyKm: ctx.history.avgWeeklyRunKm,
    easyPaceMinPerKm: ctx.history.easyPaceMinPerKm ?? DEFAULT_EASY_PACE_MIN_PER_KM,
    experience: ctx.experience,
    maxSessionMin: ctx.preferences.maxSessionMin,
    daysPerWeek: ctx.preferences.daysPerWeek,
    exerciseMuscles,
  };
}
