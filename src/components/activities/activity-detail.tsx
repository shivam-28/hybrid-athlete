import { formatDuration, formatPaceOrSpeed } from "@/lib/activities/format";
import { zoneBounds } from "@/lib/activities/heart-rate";
import type { UnitSystem } from "@/lib/units";
import type { ActivityRow, SplitRow } from "@/server/activities/views";

const ZONE_COLORS = ["bg-sky-400", "bg-emerald-500", "bg-yellow-400", "bg-orange-500", "bg-red-500"];

export function HrZones({ activity }: { activity: ActivityRow }) {
  if (!activity.hr_zone_s || !activity.max_hr_used) {
    return <p className="text-muted-foreground text-sm">Heart-rate zones: not available.</p>;
  }
  const total = activity.hr_zone_s.reduce((s, v) => s + v, 0) || 1;
  const bounds = zoneBounds(activity.max_hr_used);
  return (
    <div className="space-y-2">
      <div className="flex h-4 overflow-hidden rounded-full" aria-hidden>
        {activity.hr_zone_s.map((s, i) => (
          <div key={i} className={ZONE_COLORS[i]} style={{ width: `${(s / total) * 100}%` }} />
        ))}
      </div>
      <table className="w-full text-sm" aria-label="Time in heart-rate zones">
        <tbody>
          {bounds.map((b, i) => (
            <tr key={b.zone}>
              <th scope="row" className="text-left font-normal">
                <span className={`mr-2 inline-block size-2 rounded-full ${ZONE_COLORS[i]}`} aria-hidden />Zone {b.zone}
              </th>
              <td className="text-muted-foreground">{b.min}–{b.max} bpm</td>
              <td className="text-right">{formatDuration(activity.hr_zone_s![i]!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground text-xs">
        Max HR {activity.max_hr_used} bpm, {activity.max_hr_source === "profile" ? "from your profile" : "estimated from age"}.
      </p>
    </div>
  );
}

export function SplitsTable({ splits, units }: { splits: SplitRow[]; units: UnitSystem }) {
  return (
    <table className="w-full text-sm" aria-label="Splits">
      <thead className="text-muted-foreground text-left">
        <tr>
          <th className="font-normal">{units === "metric" ? "km" : "Split"}</th>
          <th className="font-normal">Time</th>
          <th className="font-normal">Pace</th>
          <th className="font-normal">HR</th>
          <th className="font-normal">Elev</th>
        </tr>
      </thead>
      <tbody>
        {splits.map((s) => (
          <tr key={s.idx}>
            <td>{s.distance_m >= 1000 ? s.idx + 1 : `${(s.distance_m / 1000).toFixed(2)}`}</td>
            <td>{formatDuration(s.duration_s)}</td>
            <td>{formatPaceOrSpeed("running", s.distance_m, s.duration_s, units)}</td>
            <td>{s.avg_hr ?? "–"}</td>
            <td>{s.elev_delta_m === null ? "–" : `${s.elev_delta_m > 0 ? "+" : ""}${Math.round(s.elev_delta_m)} m`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
