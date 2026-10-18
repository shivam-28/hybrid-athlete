import type { Metadata } from "next";
import { Suspense } from "react";
import { BodyNav } from "@/components/body/body-nav";
import { MeasurementCharts, type MeasurementPoint } from "@/components/body/measurement-charts";
import { MeasurementForm } from "@/components/body/measurement-form";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { loadMeasurements } from "@/server/body/views";

export const metadata: Metadata = { title: "Measurements" };

export default function MeasurementsPage() {
  return (
    <>
      <PageHeader title="Body" />
      <BodyNav active="/body/measurements" />
      <Suspense fallback={<PageSkeleton />}>
        <MeasurementsContent />
      </Suspense>
    </>
  );
}

async function MeasurementsContent() {
  const { supabase, profile } = await requireProfile("/body/measurements");
  const units = profile.unit_system as UnitSystem;
  const today = localDate(new Date(), profile.timezone);
  const rows = await loadMeasurements(supabase);
  const points: MeasurementPoint[] = rows.map((r) => ({
    date: r.local_date,
    ...(r.waist_cm !== null && { waist: Number(r.waist_cm) }),
    ...(r.hips_cm !== null && { hips: Number(r.hips_cm) }),
    ...(r.chest_cm !== null && { chest: Number(r.chest_cm) }),
    ...(r.arm_cm !== null && { arm: Number(r.arm_cm) }),
    ...(r.thigh_cm !== null && { thigh: Number(r.thigh_cm) }),
  }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add measurements</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementForm units={units} today={today} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementCharts points={points} units={units} today={today} />
        </CardContent>
      </Card>
    </>
  );
}
