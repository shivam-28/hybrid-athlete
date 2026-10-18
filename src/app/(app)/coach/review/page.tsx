import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CoachNav } from "@/components/coach/coach-nav";
import { ReviewSummary } from "@/components/coach/review-summary";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { RequiresAiKey } from "@/components/requires-ai-key";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "@/lib/activities/dates";
import { formatKm } from "@/lib/activities/format";
import { displayWeight, weightUnit } from "@/lib/body/format";
import { formatWeekRange } from "@/lib/coach/format";
import { isoWeekStart, localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { getAiKeyStatus } from "@/server/ai/keys";
import { requireProfile } from "@/server/auth";
import { loadWeeklyReview } from "@/server/coach/review";

export const metadata: Metadata = { title: "Weekly review" };

const DIRECTION_LABELS = { down: "down", up: "up", flat: "steady" } as const;

export default function CoachReviewPage({ searchParams }: PageProps<"/coach/review">) {
  return (
    <>
      <PageHeader title="Coach" />
      <CoachNav active="/coach/review" />
      <Suspense fallback={<PageSkeleton />}>
        <ReviewContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReviewContent({ searchParams }: { searchParams: PageProps<"/coach/review">["searchParams"] }) {
  const { supabase, profile, user } = await requireProfile("/coach/review");
  const thisWeek = isoWeekStart(localDate(new Date(), profile.timezone));
  const requested = (await searchParams).week;
  const week = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && isoWeekStart(requested) === requested ? requested : thisWeek;
  const [review, aiKey] = await Promise.all([loadWeeklyReview(supabase, profile, week), getAiKeyStatus(user.id)]);
  const units = profile.unit_system as UnitSystem;
  const w = review.weight;

  return (
    <>
      <nav aria-label="Week" className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={`/coach/review?week=${addDays(week, -7)}`} aria-label="Previous week">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <p className="font-medium">{formatWeekRange(week)}</p>
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={`/coach/review?week=${addDays(week, 7)}`} aria-label="Next week">
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Adherence</CardTitle>
        </CardHeader>
        <CardContent>
          {review.adherencePct === null ? (
            <p className="text-muted-foreground text-sm">No accepted plan for this week.</p>
          ) : (
            <>
              <p className="text-3xl font-semibold" aria-label={`Adherence ${review.adherencePct}%`}>{review.adherencePct}%</p>
              <p className="text-muted-foreground text-sm">
                {review.completedSessions} of {review.plannedSessions} planned sessions done · {review.skippedSessions} skipped · {review.missedSessions} not done
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Running</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {formatKm(review.runKm, units)} done · {formatKm(review.plannedRunKm, units)} planned
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strength: working sets per muscle group</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(review.setsPerMuscle).map(([muscle, sets]) => (
                <tr key={muscle} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal capitalize">{muscle}</th>
                  <td className="py-1.5 text-right tabular-nums">{sets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weight trend</CardTitle>
        </CardHeader>
        <CardContent>
          {w ? (
            <p className="text-sm">
              {displayWeight(w.startKg, units)} → {displayWeight(w.endKg, units)} {weightUnit(units)} ({DIRECTION_LABELS[w.direction]})
              {w.onTrack !== null && <> · {w.onTrack ? "on track for your goal" : "not moving toward your goal"}</>}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Not enough weigh-ins this week.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coach summary</CardTitle>
        </CardHeader>
        <CardContent>
          <RequiresAiKey available={aiKey !== null && !aiKey.invalid} feature="The AI coach summary">
            <ReviewSummary weekStart={week} />
          </RequiresAiKey>
        </CardContent>
      </Card>
    </>
  );
}
