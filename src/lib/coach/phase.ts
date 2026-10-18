import { daysBetween } from "@/lib/activities/dates";

export type TrainingPhase = "base" | "build" | "peak" | "taper";

export const PHASE_INFO: Record<TrainingPhase, { label: string; intent: string }> = {
  base: { label: "Base", intent: "Build aerobic volume gradually with mostly easy running and consistent strength work." },
  build: { label: "Build", intent: "Add race-specific quality (tempo, intervals) while long runs grow; keep strength to maintenance-plus." },
  peak: { label: "Peak", intent: "Highest race-specific load; protect recovery, reduce strength volume." },
  taper: { label: "Taper", intent: "Cut volume 30–50% while keeping some intensity; arrive fresh." },
};

/** Whole weeks from the plan week's Monday to the race date (negative when the race is before the week). */
export function weeksToRace(raceDate: string, weekStart: string): number {
  return Math.floor(daysBetween(weekStart, raceDate) / 7);
}

/** Spec: no race or > 16 weeks → base; 16–7 → build; 6–3 → peak; ≤ 2 → taper. */
export function derivePhase(raceDate: string | null, weekStart: string): TrainingPhase {
  if (!raceDate || raceDate < weekStart) return "base";
  const weeks = weeksToRace(raceDate, weekStart);
  if (weeks > 16) return "base";
  if (weeks >= 7) return "build";
  if (weeks >= 3) return "peak";
  return "taper";
}
