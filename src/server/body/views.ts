import "server-only";
import { weeklyRate, type WeeklyRate } from "@/lib/body/rate";
import { trendSeries, type TrendPoint } from "@/lib/body/trend";
import { listDailyWeights, listMeasurements, listWeightEntries, type Db, type MeasurementRow, type WeightRow } from "./weights";

export type WeightOverview = {
  series: TrendPoint[];
  sources: Record<string, "manual" | "apple_health">;
  rate: WeeklyRate | null;
  latestTrendKg: number | null;
  entries: WeightRow[];
};

/** Weight history with trend and rate, computed on read over the full history (design D3). */
export async function loadWeightOverview(db: Db, today: string): Promise<WeightOverview> {
  const [daily, entries] = await Promise.all([listDailyWeights(db), listWeightEntries(db)]);
  const series = trendSeries(
    daily.map((d) => ({ date: d.date, weightKg: d.weightKg })),
    today,
  );
  return {
    series,
    sources: Object.fromEntries(daily.map((d) => [d.date, d.source])),
    rate: weeklyRate(series, today),
    latestTrendKg: series.at(-1)?.trendKg ?? null,
    entries,
  };
}

export async function loadMeasurements(db: Db): Promise<MeasurementRow[]> {
  return listMeasurements(db);
}
