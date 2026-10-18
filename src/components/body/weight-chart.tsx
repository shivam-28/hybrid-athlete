"use client";

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { displayWeight, weightUnit } from "@/lib/body/format";
import { formatShortDate } from "@/lib/activities/format";
import type { TrendPoint } from "@/lib/body/trend";
import type { UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";

export const RANGES = { "4w": 28, "12w": 84, "1y": 365 } as const;
export type RangeKey = keyof typeof RANGES;

export function RangeTabs(props: { value: RangeKey; onChange: (r: RangeKey) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={props.label} className="flex gap-1">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={props.value === key}
          onClick={() => props.onChange(key)}
          className={cn(
            "min-h-11 min-w-11 rounded-md px-3 text-sm",
            props.value === key ? "bg-secondary font-semibold" : "text-muted-foreground",
          )}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

export function WeightChart(props: { series: TrendPoint[]; units: UnitSystem; range: RangeKey }) {
  const { range } = props;
  const unit = weightUnit(props.units);
  const data = props.series.slice(-RANGES[range]).map((p) => ({
    date: formatShortDate(p.date),
    weight: p.weightKg === null ? null : displayWeight(p.weightKg, props.units),
    trend: displayWeight(p.trendKg, props.units),
  }));
  const last = data.at(-1);

  return (
    <div className="space-y-2">
      <div
        className="h-56"
        role="img"
        aria-label={`Daily weight and trend for the last ${range}${last ? `; trend now ${last.trend} ${unit}` : ""}`}
        data-testid="weight-chart"
        data-points={data.filter((d) => d.weight !== null).length}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
            <Tooltip formatter={(v, name) => [`${v} ${unit}`, name === "trend" ? "Trend" : "Weight"]} />
            <Scatter dataKey="weight" fill="var(--chart-2)" isAnimationActive={false} />
            <Line dataKey="trend" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground text-xs">Dots are daily weigh-ins; the line is the smoothed trend that filters out water swings.</p>
    </div>
  );
}
