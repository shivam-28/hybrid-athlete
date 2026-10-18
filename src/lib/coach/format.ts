import type { PlanSession } from "./plan-schema";
import type { ReadinessScore } from "./readiness";

export const SESSION_LABELS: Record<PlanSession["type"], string> = {
  strength: "Strength",
  run: "Run",
  core: "Core",
  mobility: "Mobility",
  rest: "Rest",
};
export const RUN_TYPE_LABELS = { easy: "Easy", long: "Long", tempo: "Tempo", intervals: "Intervals", recovery: "Recovery" } as const;
export const FOCUS_LABELS = { upper: "Upper body", lower: "Lower body", full: "Full body", push: "Push", pull: "Pull", legs: "Legs" } as const;
export const SCORE_LABELS: Record<ReadinessScore, string> = { green: "Ready to train", amber: "Train lighter", red: "Recover today" };
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function sessionTitle(s: PlanSession): string {
  return s.type === "rest" ? s.title || "Rest" : s.title;
}

/** One-line summary, e.g. "Long run · 14 km · zone 2" or "Full body · 60 min · 6 exercises". */
export function sessionSummary(s: PlanSession): string {
  switch (s.type) {
    case "run":
      return [
        `${RUN_TYPE_LABELS[s.run_type]} run`,
        s.distance_km != null ? `${s.distance_km} km` : null,
        s.duration_min != null ? `${s.duration_min} min` : null,
        s.hr_zone != null ? `zone ${s.hr_zone}` : null,
        s.pace ? `${s.pace}/km` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "strength":
      return `${FOCUS_LABELS[s.focus]} · ${s.duration_min} min · ${s.exercises.length} exercise${s.exercises.length === 1 ? "" : "s"}`;
    case "core":
      return `Core · ${s.duration_min} min`;
    case "mobility":
      return `Mobility · ${s.duration_min} min`;
    case "rest":
      return "Rest day";
  }
}

export function exerciseLine(e: { name: string; sets: number; rep_min: number; rep_max: number; rpe_cap?: number | null }): string {
  const reps = e.rep_min === e.rep_max ? `${e.rep_min}` : `${e.rep_min}–${e.rep_max}`;
  return `${e.name} ${e.sets} × ${reps}${e.rpe_cap ? ` (RPE ≤ ${e.rpe_cap})` : ""}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: "UTC" }).format(d);
  return `${fmt(start, start.getUTCMonth() !== end.getUTCMonth())} – ${fmt(end, true)}`;
}
