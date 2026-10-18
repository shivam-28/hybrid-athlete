import { addDays, daysBetween } from "./dates";
import { zoneOf } from "./heart-rate";

export type LoadInput = { sport: string; movingS: number | null; elapsedS: number | null; avgHr: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Simplified session-TRIMP: moving minutes × zone of average HR (sport default without HR). */
export function activityLoad(activity: LoadInput, maxHr: number): number | null {
  const seconds = activity.movingS ?? activity.elapsedS;
  if (seconds === null) return null;
  const intensity = activity.avgHr ? Math.max(1, zoneOf(activity.avgHr, maxHr)) : activity.sport === "walking" ? 1 : 2;
  return round1((seconds / 60) * intensity);
}

export const BASELINE_DAYS = 21;

export type TrainingLoad = { acute: number; chronic: number; ratio: number | null; baselineReady: boolean };

/**
 * Acute = last 7 days, chronic = last 28 days ÷ 4 (weekly units). The ratio is withheld
 * until 21 days have passed since the first activity. `firstActivityDate` defaults to the oldest row.
 */
export function trainingLoad(
  rows: { local_date: string; load: number | null }[],
  today: string,
  firstActivityDate = rows.map((r) => r.local_date).sort()[0],
): TrainingLoad {
  const sumSince = (from: string) =>
    rows.filter((r) => r.local_date >= from && r.local_date <= today).reduce((sum, r) => sum + (r.load ?? 0), 0);
  const acute = round1(sumSince(addDays(today, -6)));
  const chronic = round1(sumSince(addDays(today, -27)) / 4);
  const baselineReady = firstActivityDate !== undefined && daysBetween(firstActivityDate, today) >= BASELINE_DAYS;
  const ratio = baselineReady && chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
  return { acute, chronic, ratio, baselineReady };
}
