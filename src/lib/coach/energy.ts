import { DEFAULT_EASY_PACE_MIN_PER_KM, runKm, runMinutes } from "./guardrails";
import type { PlanSession } from "./plan-schema";

const RUN_KCAL_PER_KG_KM = 1.0;
const MET_STRENGTH = 5;
const MET_LIGHT = 3;

/** Design D8: planned-session energy before the session is recorded. */
export function estimatePlannedEnergy(session: PlanSession, weightKg: number, easyPaceMinPerKm: number | null): { kcal: number; runMinutes: number } {
  const pace = easyPaceMinPerKm ?? DEFAULT_EASY_PACE_MIN_PER_KM;
  switch (session.type) {
    case "run":
      return { kcal: Math.round(runKm(session, pace) * weightKg * RUN_KCAL_PER_KG_KM), runMinutes: Math.round(runMinutes(session, pace)) };
    case "strength":
      return { kcal: Math.round((MET_STRENGTH * weightKg * session.duration_min) / 60), runMinutes: 0 };
    case "core":
    case "mobility":
      return { kcal: Math.round((MET_LIGHT * weightKg * session.duration_min) / 60), runMinutes: 0 };
    case "rest":
      return { kcal: 0, runMinutes: 0 };
  }
}

export type PlannedEnergy = { id: string; label: string; kcal: number; runMinutes: number };

/** Input for nutrition targets: open sessions only (completed ones count via their recorded energy, skipped ones not at all). */
export function plannedEnergyInput(
  row: { id: string; status: string; details: unknown; adjusted_details: unknown },
  weightKg: number,
  easyPaceMinPerKm: number | null,
): PlannedEnergy | null {
  if (row.status !== "planned") return null;
  const session = (row.adjusted_details ?? row.details) as PlanSession;
  const { kcal, runMinutes } = estimatePlannedEnergy(session, weightKg, easyPaceMinPerKm);
  if (kcal === 0) return null;
  const distance = session.type === "run" && session.distance_km ? ` ${session.distance_km} km` : "";
  const title = "title" in session && session.title ? session.title : session.type;
  return { id: row.id, label: `Planned: ${title}${distance}`, kcal, runMinutes };
}
