import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { CoachNav } from "@/components/coach/coach-nav";
import { GeneratePlanButton } from "@/components/coach/generate-plan-button";
import { PlanReview, type ReviewSession } from "@/components/coach/plan-review";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { RequiresAiKey } from "@/components/requires-ai-key";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addDays } from "@/lib/activities/dates";
import { formatWeekRange } from "@/lib/coach/format";
import type { TrainingPhase } from "@/lib/coach/phase";
import type { PlanSession } from "@/lib/coach/plan-schema";
import { isoWeekStart, localDate } from "@/lib/time";
import { getAiKeyStatus } from "@/server/ai/keys";
import { requireProfile } from "@/server/auth";
import { getPlanForWeek } from "@/server/coach/plans";
import { getPreferences } from "@/server/coach/preferences";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage({ searchParams }: PageProps<"/coach">) {
  return (
    <>
      <PageHeader title="Coach" />
      <CoachNav active="/coach" />
      <Suspense fallback={<PageSkeleton />}>
        <CoachContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CoachContent({ searchParams }: { searchParams: PageProps<"/coach">["searchParams"] }) {
  const { supabase, profile, user } = await requireProfile("/coach");
  const thisWeek = isoWeekStart(localDate(new Date(), profile.timezone));
  const requested = (await searchParams).week;
  const week = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && isoWeekStart(requested) === requested ? requested : thisWeek;

  const [preferences, plan, aiKey] = await Promise.all([getPreferences(supabase), getPlanForWeek(supabase, week), getAiKeyStatus(user.id)]);
  const aiAvailable = aiKey !== null && !aiKey.invalid;

  if (!preferences) {
    return (
      <EmptyState icon={Sparkles} title="Tell your coach how you train">
        Set your available days, session length, long-run day and any target race to get a weekly plan.{" "}
        <Link href="/coach/preferences" className="text-foreground underline">
          Set preferences
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <nav aria-label="Week" className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={`/coach?week=${addDays(week, -7)}`} aria-label="Previous week">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <p className="font-medium">
          {week === thisWeek ? "This week" : week === addDays(thisWeek, 7) ? "Next week" : "Week of"} · {formatWeekRange(week)}
        </p>
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={`/coach?week=${addDays(week, 7)}`} aria-label="Next week">
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </nav>

      {plan ? (
        <PlanReview
          key={`${plan.plan.id}-${plan.plan.updated_at}`}
          planId={plan.plan.id}
          status={plan.plan.status as "draft" | "active" | "superseded"}
          weekStart={plan.plan.week_start}
          phase={plan.plan.phase as TrainingPhase}
          sessions={plan.sessions.map(
            (s): ReviewSession => ({ id: s.id, day_index: s.day_index, status: s.status, details: s.details as PlanSession }),
          )}
          guardrails={plan.guardrails}
          aiAvailable={aiAvailable}
        />
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              No plan for this week yet. Your coach builds it from the last 4 weeks of training, your preferences and your goal, then checks it
              against safety rules (weekly volume, 80/20 intensity, rest days, no heavy legs before long runs).
            </p>
            <RequiresAiKey available={aiAvailable} feature="Plan generation">
              <GeneratePlanButton weekStart={week} />
            </RequiresAiKey>
          </CardContent>
        </Card>
      )}
    </>
  );
}
