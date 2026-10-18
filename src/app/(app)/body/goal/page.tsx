import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BodyNav } from "@/components/body/body-nav";
import { GoalForm, UseSafeDateButton, type GoalDefaults } from "@/components/body/goal-form";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "@/lib/activities/dates";
import { displayWeight, formatDay, formatRate, weightUnit } from "@/lib/body/format";
import { PHASE_HINTS, PHASE_LABELS, formatMonths, formatWeeks } from "@/lib/body/goal-format";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { getActiveGoal, listGoalHistory } from "@/server/body/goals";
import { getGoalState } from "@/server/body/read";

export const metadata: Metadata = { title: "Body goal" };

export default function GoalPage() {
  return (
    <>
      <PageHeader title="Body" />
      <BodyNav active="/body/goal" />
      <Suspense fallback={<PageSkeleton />}>
        <GoalContent />
      </Suspense>
    </>
  );
}

async function GoalContent() {
  const { supabase, profile } = await requireProfile("/body/goal");
  const units = profile.unit_system as UnitSystem;
  const unit = weightUnit(units);
  const today = localDate(new Date(), profile.timezone);
  const [goal, history, result] = await Promise.all([getActiveGoal(supabase), listGoalHistory(supabase), getGoalState(supabase, profile, today)]);
  const w = (kg: number) => `${displayWeight(kg, units)} ${unit}`;
  const defaults: GoalDefaults = {
    goalWeight: goal?.goal_weight_kg != null ? String(displayWeight(Number(goal.goal_weight_kg), units)) : "",
    goalBodyFatPct: goal?.goal_body_fat_pct != null ? String(goal.goal_body_fat_pct) : "",
    targetDate: goal?.target_date ?? "",
  };

  return (
    <>
      {goal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Your goal
              {result.state && <Badge data-testid="goal-phase">{PHASE_LABELS[result.state.phase]}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {result.state === null && result.reason === "needs_weight" && (
              <p>
                <Link href="/body" className="underline">Log a weight</Link> to see your phase, safe rate and timeline.
              </p>
            )}
            {result.state === null && result.reason === "needs_body_comp" && (
              <p>
                A body fat goal needs your lean mass: <Link href="/body/composition/new" className="underline">add a body composition test</Link> or set a goal weight.
              </p>
            )}
            {result.state && (() => {
              const e = result.evaluation;
              const p = e.projection;
              return (
                <>
                  <p className="text-muted-foreground">{PHASE_HINTS[result.state.phase]}</p>
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-muted-foreground text-xs">Goal weight</dt><dd className="font-medium">{w(result.state.goalWeightKg)}{goal.goal_weight_kg === null && " (implied)"}</dd></div>
                    {result.state.goalBodyFatPct !== null && <div><dt className="text-muted-foreground text-xs">Goal body fat</dt><dd className="font-medium">{result.state.goalBodyFatPct} %</dd></div>}
                    {p?.projectedBodyFatPct != null && <div><dt className="text-muted-foreground text-xs">Projected body fat</dt><dd className="font-medium">{p.projectedBodyFatPct.toFixed(1)} %</dd></div>}
                    {p?.goalLeanMassKg != null && <div><dt className="text-muted-foreground text-xs">Goal lean / fat mass</dt><dd className="font-medium">{w(p.goalLeanMassKg)} / {w(p.goalFatMassKg!)}</dd></div>}
                  </dl>
                  {e.targetRateKgPerWeek !== null && e.targetRateKgPerWeek !== 0 && (
                    <p data-testid="goal-timeline">
                      Target rate{" "}
                      <strong>
                        {result.state.phase === "lean_gain"
                          ? `+${displayWeight(e.targetRateKgPerMonth!, units)} ${unit}/month`
                          : formatRate(e.targetRateKgPerWeek, (e.targetRateKgPerWeek / (e.effectiveGoalWeightKg! - e.deltaKg!)) * 100, units)}
                      </strong>
                      {e.weeksToGoal !== null && (
                        <> · {result.state.phase === "lean_gain" ? formatMonths(e.monthsToGoal!) : formatWeeks(e.weeksToGoal)} to goal (around {formatDay(addDays(today, Math.ceil(e.weeksToGoal * 7)))})</>
                      )}
                    </p>
                  )}
                  {e.warnings.length > 0 && (
                    <ul role="alert" aria-label="Goal warnings" className="space-y-2 rounded-md border border-amber-500/60 bg-amber-500/10 p-3">
                      {e.warnings.map((warning) => (
                        <li key={warning.code}>
                          {warning.message}
                          {warning.code === "target_date_too_soon" && e.targetDate?.earliestSafeDate && (
                            <UseSafeDateButton units={units} defaults={defaults} safeDate={e.targetDate.earliestSafeDate} label={`Use ${formatDay(e.targetDate.earliestSafeDate)}`} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="rounded-md border p-3" data-testid="goal-progress">
                    {e.progress === null ? (
                      <p className="text-muted-foreground">Progress appears after 7 weigh-ins in 14 days.</p>
                    ) : e.progress.direction === "toward" ? (
                      <p>Moving <strong>toward your goal</strong> · ETA {formatWeeks(e.progress.etaWeeks!)} at your current trend.</p>
                    ) : (
                      <p>
                        Trend is <strong>{e.progress.direction === "away" ? "moving away from your goal" : "flat"}</strong> · not converging yet.
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{goal ? "Change goal" : "Set a goal"}</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalForm units={units} defaults={defaults} tomorrow={addDays(today, 1)} />
        </CardContent>
      </Card>

      {history.some((g) => g.status === "archived") && (
        <Card>
          <CardHeader>
            <CardTitle>Goal history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history
                .filter((g) => g.status === "archived")
                .map((g) => (
                  <li key={g.id} className="py-2">
                    {[g.goal_weight_kg !== null && w(Number(g.goal_weight_kg)), g.goal_body_fat_pct !== null && `${g.goal_body_fat_pct} %`].filter(Boolean).join(" · ")}
                    <span className="text-muted-foreground"> · set {formatDay(g.local_date)}, archived {formatDay(g.archived_at!.slice(0, 10))}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
