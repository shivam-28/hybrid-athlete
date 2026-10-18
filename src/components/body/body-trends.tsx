"use client";

import { useState } from "react";
import { addDays } from "@/lib/activities/dates";
import { formatDay, formatSignedLength } from "@/lib/body/format";
import type { TrendPoint } from "@/lib/body/trend";
import type { UnitSystem } from "@/lib/units";
import { RANGES, RangeTabs, WeightChart, type RangeKey } from "./weight-chart";

type Waist = { date: string; waistCm: number };

/** Weight chart plus waist change, both following one range selector. */
export function BodyTrends(props: { series: TrendPoint[]; waists: Waist[]; units: UnitSystem; today: string }) {
  const [range, setRange] = useState<RangeKey>("4w");
  const from = addDays(props.today, -RANGES[range] + 1);
  const waists = props.waists.filter((w) => w.date >= from);
  const first = waists[0];
  const last = waists.at(-1);

  return (
    <div className="space-y-4">
      <RangeTabs value={range} onChange={setRange} label="Chart range" />
      {props.series.length > 0 ? (
        <WeightChart series={props.series} units={props.units} range={range} />
      ) : (
        <p className="text-muted-foreground text-sm">Log a weight to start your trend.</p>
      )}
      {first && last && waists.length >= 2 && (
        <p className="rounded-md border p-3 text-sm" data-testid="waist-change">
          <span className="font-medium">Waist {formatSignedLength(last.waistCm - first.waistCm, props.units)}</span>{" "}
          <span className="text-muted-foreground">since {formatDay(first.date)}. A shrinking waist with stable weight is the clearest recomposition signal.</span>
        </p>
      )}
    </div>
  );
}
