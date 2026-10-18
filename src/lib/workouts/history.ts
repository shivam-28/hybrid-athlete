import { formatSetWeight, type UnitSystem } from "@/lib/units";
import type { TrackingMode } from "./types";

export type SetNumbers = { weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null };

/** Epley estimated one-rep max. */
export const estimatedOneRepMax = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

export function bestSet<T extends { weight_kg: number | null; reps: number | null }>(sets: T[]): T | null {
  let best: T | null = null;
  let bestE1rm = -1;
  for (const s of sets) {
    if (!s.weight_kg || !s.reps) continue;
    const e1rm = estimatedOneRepMax(s.weight_kg, s.reps);
    if (e1rm > bestE1rm) {
      best = s;
      bestE1rm = e1rm;
    }
  }
  return best;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSetValues(set: SetNumbers, system: UnitSystem, mode?: TrackingMode): string {
  if (set.reps !== null) {
    if (set.weight_kg === null || (mode === "bodyweight_reps" && set.weight_kg === 0)) return `BW × ${set.reps}`;
    const weight = formatSetWeight(set.weight_kg, system);
    return mode === "bodyweight_reps" ? `BW +${weight} × ${set.reps}` : `${weight} × ${set.reps}`;
  }
  const parts: string[] = [];
  if (set.weight_kg) parts.push(formatSetWeight(set.weight_kg, system));
  if (set.distance_m !== null) parts.push(set.distance_m >= 1000 ? `${set.distance_m / 1000} km` : `${set.distance_m} m`);
  if (set.duration_s !== null) parts.push(formatDuration(set.duration_s));
  return parts.join(" · ");
}

/** "50 kg × 8, 8, 8" when every set shares a weight, otherwise each set in full. */
export function formatSetsSummary(sets: SetNumbers[], system: UnitSystem, mode?: TrackingMode): string {
  const first = sets[0];
  if (!first) return "";
  const sameWeight = first.reps !== null && first.weight_kg !== null && sets.every((s) => s.weight_kg === first.weight_kg && s.reps !== null);
  if (sameWeight && mode !== "bodyweight_reps") {
    return `${formatSetWeight(first.weight_kg!, system)} × ${sets.map((s) => s.reps).join(", ")}`;
  }
  return sets.map((s) => formatSetValues(s, system, mode)).join(", ");
}
