"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/activities/format";
import type { WeekSummary } from "@/lib/activities/summaries";
import { kmToMiles, type UnitSystem } from "@/lib/units";

export function WeeklyKmChart(props: { weeks: WeekSummary[]; units: UnitSystem }) {
  const unit = props.units === "metric" ? "km" : "mi";
  const data = props.weeks.map((w) => ({
    week: formatShortDate(w.weekStart),
    distance: Math.round((props.units === "metric" ? w.runKm : kmToMiles(w.runKm)) * 10) / 10,
  }));
  return (
    <div className="h-40" role="img" aria-label={`Running ${unit} per week for the last ${data.length} weeks`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
          <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v} ${unit}`, "Running"]} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="distance" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
