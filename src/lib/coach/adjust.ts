import type { PlanSession } from "./plan-schema";
import type { ReadinessScore } from "./readiness";

const WALK_MAX_MIN = 30;
const LONG_RUN_FACTOR = 0.75;
const RPE_CAP = 8;

const paceToMin = (pace: string | null | undefined): number | null => {
  const m = pace?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Spec "Session adjustment by readiness": the proposed replacement for a planned
 * session, or null when it stays as planned. The original is always kept by the caller.
 */
export function adjustSession(session: PlanSession, score: ReadinessScore, easyPaceMinPerKm: number): PlanSession | null {
  if (score === "green" || session.type === "rest") return null;

  if (score === "red") {
    if (session.type === "mobility" && session.duration_min <= WALK_MAX_MIN) return null;
    const original = "duration_min" in session && session.duration_min ? session.duration_min : WALK_MAX_MIN;
    return {
      type: "mobility",
      title: "Rest, mobility or an easy walk",
      duration_min: Math.min(WALK_MAX_MIN, original),
      notes: "Readiness is red: recover today. Gentle mobility or an easy walk of up to 30 minutes, or full rest.",
    };
  }

  // amber
  switch (session.type) {
    case "run": {
      if (session.run_type === "tempo" || session.run_type === "intervals") {
        const minutes = session.duration_min ?? round1((session.distance_km ?? 0) * (paceToMin(session.pace) ?? easyPaceMinPerKm));
        return {
          type: "run",
          title: "Easy run (instead of quality)",
          run_type: "easy",
          duration_min: Math.round(minutes),
          distance_km: null,
          hr_zone: 2,
          pace: null,
          notes: `Readiness is amber: same time on feet, easy effort. Planned: ${session.title}.`,
        };
      }
      if (session.run_type === "long") {
        return {
          ...session,
          title: `${session.title} (shortened)`,
          duration_min: session.duration_min == null ? null : Math.round(session.duration_min * LONG_RUN_FACTOR),
          distance_km: session.distance_km == null ? null : round1(session.distance_km * LONG_RUN_FACTOR),
          hr_zone: 2,
          pace: null,
          notes: "Readiness is amber: 25% shorter, all easy.",
        };
      }
      return null;
    }
    case "strength":
      return {
        ...session,
        exercises: session.exercises.map((e) => ({ ...e, sets: Math.max(1, e.sets - 1), rpe_cap: RPE_CAP })),
        notes: "Readiness is amber: one set less per exercise, stop at RPE 8.",
      };
    default:
      return null;
  }
}
