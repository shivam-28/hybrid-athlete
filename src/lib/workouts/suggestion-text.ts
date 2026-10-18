import { formatSetWeight, type UnitSystem } from "@/lib/units";
import { formatDuration } from "./history";
import type { Suggestion } from "./progression";

const repsList = (reps: number[]) => (new Set(reps).size === 1 ? String(reps[0]) : reps.join(", "));

/** Human wording for a progression suggestion, e.g. "Today: 52.5 kg × 6". */
export function describeSuggestion(s: Suggestion, units: UnitSystem): { label: string; text: string } {
  switch (s.kind) {
    case "baseline":
      return { label: "Baseline", text: `First time: find a weight you can do for ${s.repMin}–${s.repMax} good reps` };
    case "hold":
      return { label: "Today", text: `Hold ${formatDuration(s.durationS)}` };
    case "deload":
      return { label: "Deload", text: `${s.weightKg === null ? "Bodyweight" : formatSetWeight(s.weightKg, units)} × ${repsList(s.reps)} — performance dipped twice, ease off` };
    default:
      return { label: "Today", text: `${s.weightKg === null ? "BW" : formatSetWeight(s.weightKg, units)} × ${repsList(s.reps)}` };
  }
}
