import { formatDuration, formatKm, formatShortDate } from "@/lib/activities/format";
import type { WeekSummary } from "@/lib/activities/summaries";
import type { UnitSystem } from "@/lib/units";
import { WeeklyKmChart } from "./weekly-km-chart";

/** Chart for a quick read, table for exact values and screen readers. */
export function WeeklySummary(props: { weeks: WeekSummary[]; units: UnitSystem }) {
  const current = props.weeks.at(-1)!;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        This week: <strong>{formatKm(current.runKm, props.units)}</strong> in {current.runs} run{current.runs === 1 ? "" : "s"}
        {current.longestRunKm > 0 && <> · longest {formatKm(current.longestRunKm, props.units)}</>}
      </p>
      <WeeklyKmChart weeks={props.weeks} units={props.units} />
      <details>
        <summary className="text-muted-foreground cursor-pointer text-sm">Weekly table</summary>
        <table className="mt-2 w-full text-sm" aria-label="Weekly running summary">
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="font-normal">Week of</th>
              <th className="font-normal">Run distance</th>
              <th className="font-normal">Runs</th>
              <th className="font-normal">Longest</th>
              <th className="font-normal">All moving time</th>
            </tr>
          </thead>
          <tbody>
            {[...props.weeks].reverse().map((w) => (
              <tr key={w.weekStart}>
                <td>{formatShortDate(w.weekStart)}</td>
                <td>{formatKm(w.runKm, props.units)}</td>
                <td>{w.runs}</td>
                <td>{formatKm(w.longestRunKm, props.units)}</td>
                <td>{formatDuration(w.movingS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
