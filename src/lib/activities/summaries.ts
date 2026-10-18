import { isoWeekStart } from "@/lib/time";
import { addDays } from "./dates";

export type WeekSummary = { weekStart: string; runKm: number; runs: number; longestRunKm: number; movingS: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monday–Sunday weeks (by stored local_date): the current week and the `previous` before it, oldest first. */
export function weeklySummaries(
  activities: { local_date: string; sport: string; distance_m: number | null; moving_s: number | null }[],
  today: string,
  previous = 8,
): WeekSummary[] {
  const current = isoWeekStart(today);
  return Array.from({ length: previous + 1 }, (_, i) => {
    const weekStart = addDays(current, (i - previous) * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = activities.filter((a) => a.local_date >= weekStart && a.local_date <= weekEnd);
    const runs = inWeek.filter((a) => a.sport === "running");
    const runMeters = runs.map((a) => a.distance_m ?? 0);
    return {
      weekStart,
      runKm: round2(runMeters.reduce((s, m) => s + m, 0) / 1000),
      runs: runs.length,
      longestRunKm: round2(Math.max(0, ...runMeters) / 1000),
      movingS: inWeek.reduce((s, a) => s + (a.moving_s ?? 0), 0),
    };
  });
}

export const MIN_DAYS_FOR_AVERAGE = 3;

/** Mean of known values over the 7 days ending today; null when fewer than 3 days have a value. */
export function sevenDayAverage(rows: { local_date: string; value: number | null }[], today: string): number | null {
  const from = addDays(today, -6);
  const known = rows.filter((r) => r.local_date >= from && r.local_date <= today && r.value !== null).map((r) => r.value!);
  if (known.length < MIN_DAYS_FOR_AVERAGE) return null;
  return known.reduce((s, v) => s + v, 0) / known.length;
}
