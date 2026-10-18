import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, HeartPulse, History, Footprints } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyVolume } from "@/components/workouts/weekly-volume";
import { WorkoutLogger } from "@/components/workouts/workout-logger";
import { isoWeekStart, localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { activeSessionView, sessionDurationMinutes, weeklyVolume } from "@/server/workouts/views";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  return (
    <>
      <PageHeader title="Train" />
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm" className="h-11">
          <Link href="/train/exercises">
            <BookOpen /> Exercises
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11">
          <Link href="/train/history">
            <History /> History
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11">
          <Link href="/train/activities">
            <Footprints /> Activities
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11">
          <Link href="/train/recovery">
            <HeartPulse /> Recovery
          </Link>
        </Button>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <TrainContent />
      </Suspense>
    </>
  );
}

async function TrainContent() {
  const { supabase, profile } = await requireProfile("/train");
  const today = localDate(new Date(), profile.timezone);
  const [view, volume] = await Promise.all([activeSessionView(supabase), weeklyVolume(supabase, isoWeekStart(today))]);
  return (
    <>
      <WorkoutLogger
        session={view && { ...view.session, durationMinutes: sessionDurationMinutes({ ...view.session, finished_at: null }) }}
        blocks={view?.blocks ?? []}
        units={profile.unit_system as UnitSystem}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week&apos;s working sets</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyVolume rows={volume} />
        </CardContent>
      </Card>
    </>
  );
}
