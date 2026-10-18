import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HrZones, SplitsTable } from "@/components/activities/activity-detail";
import { DeleteActivityButton } from "@/components/activities/delete-activity-button";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SPORT_LABELS, formatDuration, formatLocalDateTime, formatPaceOrSpeed } from "@/lib/activities/format";
import { formatDistance, type UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { getActivity } from "@/server/activities/views";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({ params }: PageProps<"/train/activities/[id]">) {
  return (
    <>
      <Link href="/train/activities" className="text-muted-foreground text-sm">← Activities</Link>
      <Suspense fallback={<PageSkeleton />}>
        <ActivityDetail params={params} />
      </Suspense>
    </>
  );
}

const NA = <span className="text-muted-foreground">not available</span>;

async function ActivityDetail({ params }: Pick<PageProps<"/train/activities/[id]">, "params">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(`/train/activities/${id}`);
  const result = await getActivity(supabase, id);
  if (!result) notFound();
  const { activity: a, splits } = result;
  const units = profile.unit_system as UnitSystem;
  const seconds = a.moving_s ?? a.elapsed_s;
  const hasFit = a.sources.includes("fit");

  const fields: [string, React.ReactNode][] = [
    ["Distance", a.distance_m ? formatDistance(a.distance_m, units) : NA],
    ["Moving time", a.moving_s ? formatDuration(a.moving_s) : NA],
    ["Elapsed time", a.elapsed_s ? formatDuration(a.elapsed_s) : NA],
    [a.sport === "running" || a.sport === "walking" ? "Avg pace" : "Avg speed", formatPaceOrSpeed(a.sport, a.distance_m, seconds, units) ?? NA],
    ["Avg heart rate", a.avg_hr ? `${a.avg_hr} bpm` : NA],
    ["Max heart rate", a.max_hr ? `${a.max_hr} bpm` : NA],
    ["Elevation gain", a.elevation_gain_m !== null ? `${Math.round(a.elevation_gain_m)} m` : NA],
    ["Calories", a.calories_kcal !== null ? `${Math.round(a.calories_kcal)} kcal` : NA],
    ["Training load", a.load !== null ? Math.round(a.load) : NA],
  ];

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{SPORT_LABELS[a.sport] ?? a.sport}</h1>
        <p className="text-muted-foreground text-sm">
          <time dateTime={a.occurred_at}>{formatLocalDateTime(a.occurred_at, profile.timezone)}</time>
        </p>
        <div className="flex gap-1" aria-label="Sources">
          {a.sources.includes("apple_health") && <Badge variant="secondary">Apple Health</Badge>}
          {hasFit && <Badge variant="secondary">FIT file</Badge>}
        </div>
      </header>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {!hasFit && (
        <p className="text-muted-foreground text-sm">
          Splits and heart-rate zones need the activity&apos;s FIT file. Upload it from Garmin Connect (Export Original) on
          the Activities page; it will merge into this activity.
        </p>
      )}

      {splits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Splits</CardTitle>
          </CardHeader>
          <CardContent>
            <SplitsTable splits={splits} units={units} />
          </CardContent>
        </Card>
      )}

      {hasFit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Heart-rate zones</CardTitle>
          </CardHeader>
          <CardContent>
            <HrZones activity={a} />
          </CardContent>
        </Card>
      )}

      <DeleteActivityButton activityId={a.id} />
    </>
  );
}
