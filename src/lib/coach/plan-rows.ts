import type { PlanSession, WeekPlan } from "./plan-schema";

export type PlannedSessionRow = {
  id: string;
  day_index: number;
  position: number;
  type: string;
  details: unknown;
  adjusted_details?: unknown;
  status?: string;
};

/** Rebuilds a WeekPlan (session ids = row ids) from stored planned sessions. */
export function planFromRows(rows: PlannedSessionRow[]): WeekPlan {
  const days: WeekPlan["days"] = Array.from({ length: 7 }, () => ({ sessions: [] }));
  for (const row of [...rows].sort((a, b) => a.day_index - b.day_index || a.position - b.position)) {
    days[row.day_index]!.sessions.push({ ...(row.details as PlanSession), id: row.id });
  }
  return { days };
}

/** Session as stored in planned_sessions.details (no id). */
export function sessionDetails(session: PlanSession): Omit<PlanSession, "id"> {
  const details = { ...session };
  delete details.id;
  return details;
}
