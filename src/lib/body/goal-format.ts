import type { GoalPhase } from "./goals";

export const PHASE_LABELS: Record<GoalPhase, string> = {
  cut: "Cut",
  lean_gain: "Lean gain",
  recomposition: "Recomposition",
  maintain: "Maintain",
};

export const PHASE_HINTS: Record<GoalPhase, string> = {
  cut: "Lose fat at a pace that protects muscle and your running.",
  lean_gain: "Gain slowly so most of it is muscle, not fat.",
  recomposition: "Hold weight steady; protein and training shift fat to muscle.",
  maintain: "Hold your current weight.",
};

export function formatWeeks(weeks: number): string {
  const w = Math.round(weeks);
  return w <= 1 ? "about 1 week" : `about ${w} weeks`;
}

export function formatMonths(months: number): string {
  const m = Math.round(months * 2) / 2;
  return `about ${m} month${m === 1 ? "" : "s"}`;
}
