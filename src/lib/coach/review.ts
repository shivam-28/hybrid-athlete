import { addDays } from "@/lib/activities/dates";
import type { GoalPhase } from "@/lib/body/goals";
import { MAJOR_MUSCLES, runKm } from "./guardrails";
import type { PlanSession } from "./plan-schema";

export type ReviewInput = {
  weekStart: string;
  /** Sessions of the week's active plan. */
  sessions: { type: string; status: string; details: unknown }[];
  /** Running activities (any dates; filtered to the week). */
  runs: { local_date: string; distance_m: number | null }[];
  /** weekly_muscle_volume for the week. */
  muscleSets: { muscle_group: string; sets: number }[];
  trend: { date: string; trendKg: number }[];
  goalPhase: GoalPhase | null;
  easyPaceMinPerKm: number;
};

type Direction = "down" | "up" | "flat";
export type WeeklyReview = {
  weekStart: string;
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  missedSessions: number;
  adherencePct: number | null;
  runKm: number;
  plannedRunKm: number;
  setsPerMuscle: Record<(typeof MAJOR_MUSCLES)[number], number>;
  weight: { startKg: number; endKg: number; changeKg: number; direction: Direction; goalDirection: Direction | null; onTrack: boolean | null } | null;
};

const FLAT_KG = 0.1;
const FLAT_GOAL_TOLERANCE_KG = 0.3;
const GOAL_DIRECTION: Record<GoalPhase, Direction> = { cut: "down", lean_gain: "up", recomposition: "flat", maintain: "flat" };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Design D10: pure weekly aggregation; every figure works without an AI key. */
export function buildWeeklyReview(input: ReviewInput): WeeklyReview {
  const weekEnd = addDays(input.weekStart, 6);
  const training = input.sessions.filter((s) => s.type !== "rest");
  const completed = training.filter((s) => s.status === "completed").length;
  const skipped = training.filter((s) => s.status === "skipped").length;

  const plannedRunKm = training
    .filter((s) => s.type === "run")
    .reduce((sum, s) => sum + runKm(s.details as Extract<PlanSession, { type: "run" }>, input.easyPaceMinPerKm), 0);
  const runKmDone = input.runs.filter((r) => r.local_date >= input.weekStart && r.local_date <= weekEnd).reduce((sum, r) => sum + (r.distance_m ?? 0) / 1000, 0);

  const setsPerMuscle = Object.fromEntries(
    MAJOR_MUSCLES.map((m) => [m, round1(input.muscleSets.filter((x) => x.muscle_group === m).reduce((s, x) => s + Number(x.sets), 0))]),
  ) as WeeklyReview["setsPerMuscle"];

  const before = input.trend.filter((p) => p.date < input.weekStart).at(-1);
  const end = input.trend.filter((p) => p.date <= weekEnd).at(-1);
  let weight: WeeklyReview["weight"] = null;
  if (before && end && end.date >= input.weekStart) {
    const changeKg = round1(end.trendKg - before.trendKg);
    const direction: Direction = changeKg <= -FLAT_KG ? "down" : changeKg >= FLAT_KG ? "up" : "flat";
    const goalDirection = input.goalPhase ? GOAL_DIRECTION[input.goalPhase] : null;
    const onTrack = goalDirection === null ? null : goalDirection === "flat" ? Math.abs(changeKg) <= FLAT_GOAL_TOLERANCE_KG : direction === goalDirection;
    weight = { startKg: before.trendKg, endKg: end.trendKg, changeKg, direction, goalDirection, onTrack };
  }

  return {
    weekStart: input.weekStart,
    plannedSessions: training.length,
    completedSessions: completed,
    skippedSessions: skipped,
    missedSessions: training.length - completed - skipped,
    adherencePct: training.length > 0 ? Math.round((completed / training.length) * 100) : null,
    runKm: round1(runKmDone),
    plannedRunKm: round1(plannedRunKm),
    setsPerMuscle,
    weight,
  };
}
