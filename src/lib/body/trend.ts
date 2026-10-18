import { addDays } from "@/lib/activities/dates";

/** Smoothing factor ≈ a 10-day window: one salty dinner or glycogen refill barely moves the trend. */
export const TREND_ALPHA = 0.1;

export type DailyWeight = { date: string; weightKg: number };
export type TrendPoint = { date: string; weightKg: number | null; trendKg: number };

/**
 * Gap-free daily series from the first weight to `endDate` (default: last weight).
 * EWMA seeded with the first weight; days without a weight carry the trend forward.
 */
export function trendSeries(weights: readonly DailyWeight[], endDate?: string): TrendPoint[] {
  if (weights.length === 0) return [];
  const byDate = new Map(weights.map((w) => [w.date, w.weightKg]));
  const dates = [...byDate.keys()].sort();
  const last = endDate && endDate > dates.at(-1)! ? endDate : dates.at(-1)!;

  const series: TrendPoint[] = [];
  let trend = byDate.get(dates[0]!)!;
  for (let date = dates[0]!; date <= last; date = addDays(date, 1)) {
    const weightKg = byDate.get(date) ?? null;
    if (weightKg !== null) trend += TREND_ALPHA * (weightKg - trend);
    series.push({ date, weightKg, trendKg: trend });
  }
  return series;
}
