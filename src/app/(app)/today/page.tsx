import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity, CalendarCheck, Dumbbell, Footprints, Salad } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { localDate } from "@/lib/time";
import { requireProfile } from "@/server/auth";
import { listSessions } from "@/server/workouts/views";
import { dayActivitySummary } from "@/server/activities/views";
import { SPORT_LABELS, formatDuration } from "@/lib/activities/format";
import { formatDistance, type UnitSystem } from "@/lib/units";
import { displayWeight, formatRate, weightUnit } from "@/lib/body/format";
import { PHASE_LABELS, formatWeeks } from "@/lib/body/goal-format";
import { getGoalState } from "@/server/body/read";
import { loadWeightOverview } from "@/server/body/views";
import { NutritionTodayCard } from "@/components/nutrition/nutrition-today-card";
import { loadDay } from "@/server/nutrition/day";
import { TodayCoachCard } from "@/components/coach/today-coach-card";
import { loadTodayCoach } from "@/server/coach/readiness";
import { isoWeekStart } from "@/lib/time";

export const metadata: Metadata = { title: "Today" };

function formatDay(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" />
      <Suspense fallback={<PageSkeleton />}>
        <TodayContent />
      </Suspense>
    </>
  );
}

async function TodayContent() {
  const { profile, supabase } = await requireProfile("/today");
  const today = localDate(new Date(), profile.timezone);
  const [workouts, day, body, goal, nutrition, coach] = await Promise.all([
    listSessions(supabase, { localDate: today }),
    dayActivitySummary(supabase, today),
    loadWeightOverview(supabase, today),
    getGoalState(supabase, profile, today),
    loadDay(supabase, profile, today),
    loadTodayCoach(supabase, profile),
  ]);
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  const units = profile.unit_system as UnitSystem;

  return (
    <>
      <p className="text-muted-foreground">
        Hi {profile.display_name} · {formatDay(today)}
      </p>
      <section className="space-y-3" aria-label="Getting started">
        {isSunday && (
          <Link href={`/coach/review?week=${isoWeekStart(today)}`} aria-label="Weekly review">
            <Card className="border-primary/50">
              <CardContent className="flex items-start gap-4">
                <CalendarCheck className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div>
                  <h2 className="font-medium">Your weekly review is ready</h2>
                  <p className="text-muted-foreground text-sm">Adherence, running volume, strength balance and weight trend for this week.</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        <TodayCoachCard data={coach} />
        {workouts.length > 0 ? (
          <Link href="/train" aria-label="Today's workout">
            <Card>
              <CardContent className="flex items-start gap-4">
                <Dumbbell className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div>
                  <h2 className="font-medium">
                    Workout {workouts.some((w) => !w.finished_at) ? "in progress" : "done"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {workouts.reduce((n, w) => n + w.exerciseCount, 0)} exercises ·{" "}
                    {workouts.reduce((n, w) => n + w.workingSets, 0)} working sets ·{" "}
                    {workouts.reduce((n, w) => n + w.durationMinutes, 0)} min
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <EmptyState icon={Dumbbell} title="Log your first workout">
            Say &ldquo;shoulder press, 12 kg, 15 reps&rdquo; or pick an exercise in Train.
          </EmptyState>
        )}
        {(day.activities.length > 0 || day.steps !== null) && (
          <Link href="/train/activities" aria-label="Today's activity">
            <Card>
              <CardContent className="flex items-start gap-4">
                <Footprints className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div>
                  <h2 className="font-medium">
                    {day.activities.length > 0
                      ? day.activities
                          .map((a) => `${SPORT_LABELS[a.sport] ?? a.sport}${a.distance_m ? ` ${formatDistance(a.distance_m, units)}` : ""}`)
                          .join(" · ")
                      : "No activity yet"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {day.activities.length > 0 &&
                      `${formatDuration(day.activities.reduce((s, a) => s + (a.moving_s ?? a.elapsed_s ?? 0), 0))} moving`}
                    {day.activities.length > 0 && day.steps !== null && " · "}
                    {day.steps !== null && `${day.steps.toLocaleString("en-GB")} steps`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        {nutrition.targets.result.ok ? (
          <NutritionTodayCard targets={nutrition.targets.result.targets} eaten={nutrition.totals} />
        ) : (
          <EmptyState icon={Salad} title="Snap your first meal">
            Calories and macros are estimated from a photo in Eat. Log your weight in Body to get daily targets.
          </EmptyState>
        )}
        {body.latestTrendKg !== null ? (
          <Link href="/body" aria-label="Body summary">
            <Card>
              <CardContent className="flex items-start gap-4">
                <Activity className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div>
                  <h2 className="font-medium">
                    Trend {displayWeight(body.latestTrendKg, units)} {weightUnit(units)}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {body.rate ? formatRate(body.rate.kgPerWeek, body.rate.pctPerWeek, units) : "Weekly rate after 7 weigh-ins in 14 days"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {goal.state
                      ? `${PHASE_LABELS[goal.state.phase]} → ${displayWeight(goal.state.goalWeightKg, units)} ${weightUnit(units)}${
                          goal.evaluation.progress?.direction === "toward" ? ` · ETA ${formatWeeks(goal.evaluation.progress.etaWeeks!)}` : ""
                        }`
                      : "No goal set yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <EmptyState icon={Activity} title="Track your body">
            Log weight, body-composition scans and progress photos in Body.
          </EmptyState>
        )}
      </section>
    </>
  );
}
