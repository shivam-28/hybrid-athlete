import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteTestButton } from "@/components/body/delete-test-button";
import { EditComposition } from "@/components/body/edit-composition";
import { toFormValues } from "@/components/body/composition-form";
import { PageSkeleton } from "@/components/page-skeleton";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { getTest } from "@/server/body/composition";
import { BodyError } from "@/server/body/errors";

export const metadata: Metadata = { title: "Body composition test" };

export default function TestPage(props: PageProps<"/body/composition/[id]">) {
  return (
    <>
      <div>
        <Link href="/body/composition" className="text-muted-foreground text-sm">← Composition</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit test</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <TestContent params={props.params} />
      </Suspense>
    </>
  );
}

async function TestContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(`/body/composition/${id}`);
  const test = await getTest(supabase, id).catch((e) => {
    if (e instanceof BodyError) notFound();
    throw e;
  });
  const units = profile.unit_system as UnitSystem;
  const values = toFormValues(
    {
      ...test,
      test_date: test.local_date,
      weight: test.weight_kg,
      fat_mass: test.fat_mass_kg,
      lean_mass: test.lean_mass_kg,
      skeletal_muscle: test.skeletal_muscle_kg,
      total_body_water: test.total_body_water_kg,
    },
    units,
  );
  return (
    <>
      {test.document_path && <p className="text-muted-foreground text-sm">Read from an uploaded report, confirmed by you.</p>}
      <EditComposition id={test.id} initial={values} units={units} />
      <DeleteTestButton id={test.id} hasReport={!!test.document_path} />
    </>
  );
}
