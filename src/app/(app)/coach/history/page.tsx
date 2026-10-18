import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { History } from "lucide-react";
import { CoachNav } from "@/components/coach/coach-nav";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatWeekRange } from "@/lib/coach/format";
import { PHASE_INFO, type TrainingPhase } from "@/lib/coach/phase";
import { requireProfile } from "@/server/auth";
import { listPlanHistory } from "@/server/coach/plans";

export const metadata: Metadata = { title: "Plan history" };

const STATUS_LABELS = { active: "Active", draft: "Draft", superseded: "Superseded" } as const;

export default function CoachHistoryPage() {
  return (
    <>
      <PageHeader title="Coach" />
      <CoachNav active="/coach/history" />
      <Suspense fallback={<PageSkeleton />}>
        <HistoryContent />
      </Suspense>
    </>
  );
}

async function HistoryContent() {
  const { supabase } = await requireProfile("/coach/history");
  const plans = await listPlanHistory(supabase);
  if (plans.length === 0) {
    return (
      <EmptyState icon={History} title="No plans yet">
        Generated and accepted plans show up here by week.
      </EmptyState>
    );
  }
  const weeks = [...new Set(plans.map((p) => p.week_start))];
  return (
    <ul className="space-y-3" aria-label="Plan history">
      {weeks.map((week) => (
        <li key={week}>
          <Card>
            <CardContent className="space-y-2">
              <Link href={`/coach?week=${week}`} className="font-medium underline-offset-4 hover:underline">
                {formatWeekRange(week)}
              </Link>
              <ul className="space-y-1">
                {plans
                  .filter((p) => p.week_start === week)
                  .map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[p.status as keyof typeof STATUS_LABELS]}</Badge>
                      <span className="text-muted-foreground">
                        {PHASE_INFO[p.phase as TrainingPhase].label} · created {p.local_date}
                        {(p.warnings as unknown[]).length > 0 ? ` · ${(p.warnings as unknown[]).length} warning(s)` : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
