import { formatShortDate } from "@/lib/activities/format";
import { sevenDayAverage } from "@/lib/activities/summaries";
import { formatWeight, type UnitSystem } from "@/lib/units";
import type { DailyMetricsRow } from "@/server/activities/views";

type MetricKey = "steps" | "active_energy_kcal" | "resting_hr_bpm" | "hrv_sdnn_ms" | "sleep_minutes" | "vo2max" | "weight_kg";

const sleep = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} min`;

const METRICS: { key: MetricKey; label: string; format: (v: number, units: UnitSystem) => string }[] = [
  { key: "steps", label: "Steps", format: (v) => Math.round(v).toLocaleString("en-GB") },
  { key: "active_energy_kcal", label: "Active energy", format: (v) => `${Math.round(v)} kcal` },
  { key: "resting_hr_bpm", label: "Resting heart rate", format: (v) => `${Math.round(v)} bpm` },
  { key: "hrv_sdnn_ms", label: "HRV (SDNN)", format: (v) => `${Math.round(v)} ms` },
  { key: "sleep_minutes", label: "Sleep", format: sleep },
  { key: "vo2max", label: "VO₂ max", format: (v) => v.toFixed(1) },
  { key: "weight_kg", label: "Weight", format: (v, units) => formatWeight(v, units) },
];

const NOT_AVAILABLE = "not available";

/** Latest value and 7-day average per metric; unknown values are never shown as 0. */
export function DailyTrends(props: { rows: DailyMetricsRow[]; today: string; units: UnitSystem }) {
  return (
    <table className="w-full text-sm" aria-label="Daily metrics">
      <thead className="text-muted-foreground text-left">
        <tr>
          <th className="font-normal">Metric</th>
          <th className="font-normal">Latest</th>
          <th className="font-normal">7-day avg</th>
        </tr>
      </thead>
      <tbody>
        {METRICS.map(({ key, label, format }) => {
          const series = props.rows.map((r) => ({ local_date: r.local_date, value: r[key] }));
          const latest = series.findLast((r) => r.value !== null);
          const avg = sevenDayAverage(series, props.today);
          return (
            <tr key={key} className="border-t">
              <th scope="row" className="py-2 text-left font-normal">{label}</th>
              <td>
                {latest ? (
                  <>
                    {format(latest.value!, props.units)}{" "}
                    <span className="text-muted-foreground text-xs">{formatShortDate(latest.local_date)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{NOT_AVAILABLE}</span>
                )}
              </td>
              <td>{avg !== null ? format(avg, props.units) : <span className="text-muted-foreground">{NOT_AVAILABLE}</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
