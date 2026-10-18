import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { ExerciseLibrary } from "@/components/workouts/exercise-library";
import { requireProfile } from "@/server/auth";

export const metadata: Metadata = { title: "Exercises" };

export default function ExercisesPage() {
  return (
    <>
      <PageHeader title="Exercises" />
      <Suspense fallback={<PageSkeleton />}>
        <Library />
      </Suspense>
    </>
  );
}

async function Library() {
  await requireProfile("/train/exercises");
  return <ExerciseLibrary />;
}
