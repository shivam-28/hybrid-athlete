import { addDays, daysBetween } from "@/lib/activities/dates";
import type { TrendPoint } from "./trend";

export const RATE_WINDOW_DAYS = 14;
export const MIN_WEIGHTS_FOR_RATE = 7;

export type WeeklyRate = { kgPerWeek: number; pctPerWeek: number };

/**
 * Weekly change of trend weight over the last 14 days (or the available span),
 * relative to the trend at the start of the window. Null = not enough data.
 */
export function weeklyRate(series: readonly TrendPoint[], today: string): WeeklyRate | null {
  const windowStart = addDays(today, -RATE_WINDOW_DAYS);
  const inWindow = series.filter((p) => p.date > windowStart && p.date <= today);
  if (inWindow.filter((p) => p.weightKg !== null).length < MIN_WEIGHTS_FOR_RATE) return null;

  const end = [...series].reverse().find((p) => p.date <= today);
  const start = series.find((p) => p.date >= windowStart);
  if (!end || !start) return null;
  const days = daysBetween(start.date, end.date);
  if (days <= 0) return null;

  const kgPerWeek = ((end.trendKg - start.trendKg) / days) * 7;
  return { kgPerWeek, pctPerWeek: (kgPerWeek / start.trendKg) * 100 };
}
