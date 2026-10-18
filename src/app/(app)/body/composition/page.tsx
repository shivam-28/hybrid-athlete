import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BodyNav } from "@/components/body/body-nav";
import { CompositionCharts } from "@/components/body/composition-charts";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { methodSeries, mixedMethodNotice } from "@/lib/body/composition-trends";
import { displayWeight, formatDay, weightUnit } from "@/lib/body/format";
import { METHOD_LABELS } from "@/lib/body/schemas";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { listTests } from "@/server/body/composition";

export const metadata: Metadata = { title: "Body composition" };

export default function CompositionPage() {
  return (
    <>
      <PageHeader title="Body" />
      <BodyNav active="/body/composition" />
      <Suspense fallback={<PageSkeleton />}>
        <CompositionContent />
      </Suspense>
    </>
  );
}

async function CompositionContent() {
  const { supabase, profile } = await requireProfile("/body/composition");
  const units = profile.unit_system as UnitSystem;
  const tests = (await listTests(supabase)).map((t) => ({
    ...t,
    body_fat_pct: t.body_fat_pct === null ? null : Number(t.body_fat_pct),
    lean_mass_kg: t.lean_mass_kg === null ? null : Number(t.lean_mass_kg),
    skeletal_muscle_kg: t.skeletal_muscle_kg === null ? null : Number(t.skeletal_muscle_kg),
  }));
  const notice = mixedMethodNotice(tests);

  return (
    <>
      <Button asChild className="h-11 w-full">
        <Link href="/body/composition/new">Add a test</Link>
      </Button>
      {tests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trends by method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CompositionCharts
              units={units}
              series={{
                body_fat_pct: methodSeries(tests, "body_fat_pct"),
                lean_mass_kg: methodSeries(tests, "lean_mass_kg"),
                skeletal_muscle_kg: methodSeries(tests, "skeletal_muscle_kg"),
              }}
            />
            {notice && <p role="note" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm">{notice}</p>}
          </CardContent>
        </Card>
      )}
      <section aria-label="Tests" className="space-y-3">
        {tests.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No tests yet. A body composition scan (InBody, DEXA…) gives your lean mass, which makes calorie targets much more accurate.
          </p>
        )}
        {tests.map((t) => (
          <Link key={t.id} href={`/body/composition/${t.id}`} className="block rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{formatDay(t.local_date)}</span>
              <Badge variant="secondary">{METHOD_LABELS[t.method]}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {[
                t.body_fat_pct !== null && `${t.body_fat_pct} % body fat${t.derived_fields.includes("body_fat_pct") ? " (derived)" : ""}`,
                t.lean_mass_kg !== null && `${displayWeight(t.lean_mass_kg, units)} ${weightUnit(units)} lean${t.derived_fields.includes("lean_mass_kg") ? " (derived)" : ""}`,
                t.skeletal_muscle_kg !== null && `${displayWeight(t.skeletal_muscle_kg, units)} ${weightUnit(units)} muscle`,
              ]
                .filter(Boolean)
                .join(" · ") || "No body fat or mass values"}
            </p>
          </Link>
        ))}
      </section>
    </>
  );
}
