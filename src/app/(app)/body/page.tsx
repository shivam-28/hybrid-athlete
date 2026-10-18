import type { Metadata } from "next";
import { Suspense } from "react";
import { BodyNav } from "@/components/body/body-nav";
import { BodyTrends } from "@/components/body/body-trends";
import { WeightEntryForm } from "@/components/body/weight-entry-form";
import { WeightHistory } from "@/components/body/weight-history";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayWeight, formatRate, weightUnit } from "@/lib/body/format";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { loadMeasurements, loadWeightOverview } from "@/server/body/views";

export const metadata: Metadata = { title: "Body" };

export default function BodyPage() {
  return (
    <>
      <PageHeader title="Body" />
      <BodyNav active="/body" />
      <Suspense fallback={<PageSkeleton />}>
        <WeightContent />
      </Suspense>
    </>
  );
}

async function WeightContent() {
  const { supabase, profile } = await requireProfile("/body");
  const units = profile.unit_system as UnitSystem;
  const today = localDate(new Date(), profile.timezone);
  const [overview, measurements] = await Promise.all([loadWeightOverview(supabase, today), loadMeasurements(supabase)]);
  const waists = measurements.filter((m) => m.waist_cm !== null).map((m) => ({ date: m.local_date, waistCm: Number(m.waist_cm) }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Log weight</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightEntryForm units={units} />
        </CardContent>
      </Card>

      <section aria-label="Weight summary" className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">Trend weight</p>
          <p className="text-xl font-semibold" data-testid="trend-weight">
            {overview.latestTrendKg === null ? "—" : `${displayWeight(overview.latestTrendKg, units)} ${weightUnit(units)}`}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">Last 14 days</p>
          <p className="text-sm font-medium" data-testid="weekly-rate">
            {overview.rate ? formatRate(overview.rate.kgPerWeek, overview.rate.pctPerWeek, units) : "Not enough data"}
          </p>
          {!overview.rate && <p className="text-muted-foreground text-xs">Needs 7 weigh-ins in 14 days.</p>}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyTrends series={overview.series} waists={waists} units={units} today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent weigh-ins</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightHistory
            entries={overview.entries.map((e) => ({ id: e.id, weight_kg: Number(e.weight_kg), occurred_at: e.occurred_at }))}
            units={units}
            timezone={profile.timezone}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Apple Health weights from your scale are used on days without a manual weigh-in; the earliest manual entry of a day wins.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
