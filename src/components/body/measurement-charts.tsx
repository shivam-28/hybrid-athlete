"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays } from "@/lib/activities/dates";
import { formatShortDate } from "@/lib/activities/format";
import { displayLength, lengthUnit } from "@/lib/body/format";
import type { UnitSystem } from "@/lib/units";
import { RANGES, RangeTabs, type RangeKey } from "./weight-chart";

export type MeasurementPoint = { date: string } & Partial<Record<"waist" | "hips" | "chest" | "arm" | "thigh", number>>;

const LABELS = { waist: "Waist", hips: "Hips", chest: "Chest", arm: "Upper arm", thigh: "Thigh" } as const;

export function MeasurementCharts(props: { points: MeasurementPoint[]; units: UnitSystem; today: string }) {
  const [range, setRange] = useState<RangeKey>("12w");
  const from = addDays(props.today, -RANGES[range] + 1);
  const points = props.points.filter((p) => p.date >= from);
  const unit = lengthUnit(props.units);

  return (
    <div className="space-y-4">
      <RangeTabs value={range} onChange={setRange} label="Measurement chart range" />
      {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => {
        const data = points.filter((p) => p[key] !== undefined).map((p) => ({ date: formatShortDate(p.date), value: displayLength(p[key]!, props.units) }));
        if (data.length === 0) return null;
        return (
          <figure key={key} className="space-y-1">
            <figcaption className="text-sm font-medium">
              {LABELS[key]} · {data.at(-1)!.value} {unit}
            </figcaption>
            <div className="h-32" role="img" aria-label={`${LABELS[key]} over the last ${range}, latest ${data.at(-1)!.value} ${unit}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} ${unit}`, LABELS[key]]} />
                  <Line dataKey="value" stroke={key === "waist" ? "var(--chart-1)" : "var(--chart-3)"} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
        );
      })}
      {points.length === 0 && <p className="text-muted-foreground text-sm">No measurements in this range yet.</p>}
    </div>
  );
}
