"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/activities/format";
import type { CompositionMetric, MethodSeries } from "@/lib/body/composition-trends";
import { displayWeight } from "@/lib/body/format";
import { METHOD_LABELS, type CompMethod } from "@/lib/body/schemas";
import type { UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";

const METRICS: { key: CompositionMetric; label: string }[] = [
  { key: "body_fat_pct", label: "Body fat %" },
  { key: "lean_mass_kg", label: "Lean mass" },
  { key: "skeletal_muscle_kg", label: "Muscle mass" },
];
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function CompositionCharts(props: { series: Record<CompositionMetric, MethodSeries[]>; units: UnitSystem }) {
  const [metric, setMetric] = useState<CompositionMetric>("body_fat_pct");
  const series = props.series[metric];
  const unit = metric === "body_fat_pct" ? "%" : props.units === "metric" ? "kg" : "lb";
  const value = (v: number) => (metric === "body_fat_pct" ? v : displayWeight(v, props.units));
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  // One row per date, one column per method: lines connect points of the same method only.
  const data = dates.map((date) => ({
    date: formatShortDate(date),
    ...Object.fromEntries(series.map((s) => [s.method, s.points.find((p) => p.date === date)?.value ?? null]).map(([m, v]) => [m, v === null ? null : value(v as number)])),
  }));

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Metric" className="flex gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={cn("min-h-11 rounded-md px-3 text-sm", metric === m.key ? "bg-secondary font-semibold" : "text-muted-foreground")}
          >
            {m.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tests with this value yet.</p>
      ) : (
        <div className="h-52" role="img" aria-label={`${METRICS.find((m) => m.key === metric)!.label} by test method over time`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} allowDecimals={false} />
              <Tooltip formatter={(v, name) => [`${v} ${unit}`, METHOD_LABELS[name as CompMethod] ?? name]} />
              <Legend formatter={(name) => METHOD_LABELS[name as CompMethod] ?? name} />
              {series.map((s, i) => (
                <Line key={s.method} dataKey={s.method} stroke={COLORS[i % COLORS.length]} strokeWidth={2} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
