import { METHOD_LABELS, type CompMethod } from "./schemas";

type TestLike = {
  local_date: string;
  method: string;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  skeletal_muscle_kg: number | null;
};
export type CompositionMetric = "body_fat_pct" | "lean_mass_kg" | "skeletal_muscle_kg";
export type MethodSeries = { method: string; points: { date: string; value: number }[] };

/** One series per method (oldest first): trend lines never connect different methods. */
export function methodSeries(tests: readonly TestLike[], metric: CompositionMetric): MethodSeries[] {
  const byMethod = new Map<string, MethodSeries>();
  for (const t of [...tests].sort((a, b) => a.local_date.localeCompare(b.local_date))) {
    const value = t[metric];
    if (value === null) continue;
    const series = byMethod.get(t.method) ?? { method: t.method, points: [] };
    series.points.push({ date: t.local_date, value: Number(value) });
    byMethod.set(t.method, series);
  }
  return [...byMethod.values()];
}

const label = (m: string) => METHOD_LABELS[m as CompMethod] ?? m;

/** Notice when the two most recent tests used different methods (e.g. InBody then DEXA). */
export function mixedMethodNotice(tests: readonly TestLike[]): string | null {
  const [latest, previous] = [...tests].sort((a, b) => b.local_date.localeCompare(a.local_date));
  if (!latest || !previous || latest.method === previous.method) return null;
  return `Your last two tests used different methods (${label(previous.method)} then ${label(latest.method)}). Results from different methods are not directly comparable; compare like with like.`;
}
