import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CustomExerciseForm } from "@/components/workouts/custom-exercise-form";
import { requireProfile } from "@/server/auth";

export const metadata: Metadata = { title: "New exercise" };

export default function NewExercisePage({ searchParams }: PageProps<"/train/exercises/new">) {
  return (
    <>
      <PageHeader title="Custom exercise" subtitle="Only you can see your custom exercises." />
      <Suspense fallback={<PageSkeleton />}>
        <NewExercise searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewExercise({ searchParams }: Pick<PageProps<"/train/exercises/new">, "searchParams">) {
  await requireProfile("/train/exercises/new");
  const { name } = await searchParams;
  return <CustomExerciseForm initial={{ name: typeof name === "string" ? name : "" }} />;
}
