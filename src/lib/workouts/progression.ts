import { estimatedOneRepMax } from "./history";
import type { TrackingMode } from "./types";

export type ProgressionExercise = { tracking_mode: TrackingMode; mechanic: string | null; equipment: string | null };
export type ProgressionSettings = {
  rep_min: number | null;
  rep_max: number | null;
  increment_kg: number | null;
  duration_increment_s: number | null;
};
/** Working sets of one past session. */
export type SessionSets = { weight_kg: number | null; reps: number | null; duration_s: number | null }[];

export type Suggestion =
  | { kind: "baseline"; repMin: number; repMax: number }
  | { kind: "increase" | "add_rep" | "deload"; weightKg: number | null; reps: number[] }
  | { kind: "hold"; durationS: number };

const INCREMENT_BY_EQUIPMENT: Record<string, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 2.5,
  cable: 2.5,
  kettlebells: 4,
};

export function progressionDefaults(exercise: ProgressionExercise) {
  const range =
    exercise.tracking_mode === "bodyweight_reps"
      ? { repMin: 8, repMax: 15 }
      : exercise.mechanic === "isolation"
        ? { repMin: 10, repMax: 15 }
        : { repMin: 6, repMax: 10 };
  return { ...range, incrementKg: INCREMENT_BY_EQUIPMENT[exercise.equipment ?? ""] ?? 2.5, durationIncrementS: 5 };
}

function effectiveSettings(exercise: ProgressionExercise, settings: ProgressionSettings | null) {
  const d = progressionDefaults(exercise);
  return {
    repMin: settings?.rep_min ?? d.repMin,
    repMax: settings?.rep_max ?? d.repMax,
    incrementKg: settings?.increment_kg ?? d.incrementKg,
    durationIncrementS: settings?.duration_increment_s ?? d.durationIncrementS,
  };
}

const roundTo = (value: number, step: number) => Math.round(Math.round(value / step) * step * 100) / 100;

function performance(mode: TrackingMode, sets: SessionSets): number {
  const values = sets.map((s) =>
    mode === "duration" ? (s.duration_s ?? 0) : mode === "bodyweight_reps" ? (s.reps ?? 0) : estimatedOneRepMax(s.weight_kg ?? 0, s.reps ?? 0),
  );
  return Math.max(0, ...values);
}

/** +1 rep on the lowest-rep set (the first one, if tied), capped at the top of the range. */
function addRepToLowest(reps: number[], repMax: number): number[] {
  const lowest = reps.indexOf(Math.min(...reps));
  return reps.map((r, i) => (i === lowest ? Math.min(r + 1, repMax) : r));
}

/**
 * Double progression for the next session. `sessions` are previous sessions' working
 * sets for this exercise, newest first. Advisory only: nothing is persisted.
 */
export function suggestNext(exercise: ProgressionExercise, settings: ProgressionSettings | null, sessions: SessionSets[]): Suggestion {
  const s = effectiveSettings(exercise, settings);
  const latest = sessions[0];
  if (!latest || latest.length === 0) return { kind: "baseline", repMin: s.repMin, repMax: s.repMax };
  const mode = exercise.tracking_mode;

  const [p0, p1, p2] = sessions.slice(0, 3).map((sets) => performance(mode, sets));
  if (p0 !== undefined && p1 !== undefined && p2 !== undefined && p0 < p1 && p1 < p2) {
    if (mode === "duration") return { kind: "hold", durationS: Math.max(5, roundTo(p0 * 0.9, 5)) };
    const top = Math.max(...latest.map((x) => x.weight_kg ?? 0));
    return {
      kind: "deload",
      weightKg: top > 0 ? roundTo(top * 0.9, s.incrementKg) : null,
      reps: latest.map(() => s.repMin),
    };
  }

  if (mode === "duration" || mode === "distance_duration") {
    return { kind: "hold", durationS: Math.max(...latest.map((x) => x.duration_s ?? 0)) + s.durationIncrementS };
  }

  const reps = latest.map((x) => x.reps ?? 0);
  const weights = latest.map((x) => x.weight_kg ?? 0);
  const top = Math.max(...weights);
  const sameWeight = weights.every((w) => w === top);
  const allAtTop = reps.every((r) => r >= s.repMax);

  if (allAtTop && sameWeight) {
    return { kind: "increase", weightKg: roundTo(top + s.incrementKg, 0.25), reps: latest.map(() => s.repMin) };
  }
  return { kind: "add_rep", weightKg: mode === "bodyweight_reps" && top === 0 ? null : top, reps: addRepToLowest(reps, s.repMax) };
}
