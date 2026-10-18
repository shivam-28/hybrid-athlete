import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityList, SportFilter } from "@/components/activities/activity-list";
import { FitUpload } from "@/components/activities/fit-upload";
import { TrainingLoadPanel } from "@/components/activities/training-load-panel";
import { WeeklySummary } from "@/components/activities/weekly-summary";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { isSport, listActivities, trainingOverview } from "@/server/activities/views";

export const metadata: Metadata = { title: "Activities" };

export default function ActivitiesPage({ searchParams }: PageProps<"/train/activities">) {
  return (
    <>
      <div>
        <Link href="/train" className="text-muted-foreground text-sm">← Train</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
      </div>
      <FitUpload />
      <Suspense fallback={<PageSkeleton />}>
        <ActivitiesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ActivitiesContent({ searchParams }: Pick<PageProps<"/train/activities">, "searchParams">) {
  const { sport } = await searchParams;
  const filter = isSport(sport) ? sport : null;
  const { supabase, profile } = await requireProfile("/train/activities");
  const units = profile.unit_system as UnitSystem;
  const today = localDate(new Date(), profile.timezone);
  const [overview, activities] = await Promise.all([
    trainingOverview(supabase, today),
    listActivities(supabase, { sport: filter ?? undefined }),
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Running volume</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklySummary weeks={overview.weeks} units={units} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training load</CardTitle>
        </CardHeader>
        <CardContent>
          <TrainingLoadPanel load={overview.load} />
        </CardContent>
      </Card>
      <section className="space-y-3" aria-label="Activity history">
        <SportFilter active={filter} />
        <ActivityList activities={activities} timezone={profile.timezone} units={units} />
      </section>
    </>
  );
}
