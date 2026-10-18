import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DailyTrends } from "@/components/activities/daily-trends";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { recentDailyMetrics } from "@/server/activities/views";

export const metadata: Metadata = { title: "Recovery" };

export default function RecoveryPage() {
  return (
    <>
      <div>
        <Link href="/train" className="text-muted-foreground text-sm">← Train</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Recovery & daily metrics</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <RecoveryContent />
      </Suspense>
    </>
  );
}

async function RecoveryContent() {
  const { supabase, profile } = await requireProfile("/train/recovery");
  const today = localDate(new Date(), profile.timezone);
  const rows = await recentDailyMetrics(supabase, today);
  return (
    <>
      <Card>
        <CardContent>
          <DailyTrends rows={rows} today={today} units={profile.unit_system as UnitSystem} />
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-sm">
        Averages use only days with a value and need at least 3 of the last 7 days. Data arrives from Apple Health via{" "}
        <Link href="/settings/apple-health" className="underline">your Shortcut</Link>.
      </p>
    </>
  );
}
