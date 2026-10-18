import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CustomExerciseForm } from "@/components/workouts/custom-exercise-form";
import type { EQUIPMENT } from "@/lib/workouts/types";
import { requireProfile } from "@/server/auth";
import { getExercise } from "@/server/workouts/exercises";

export const metadata: Metadata = { title: "Edit exercise" };

export default function EditExercisePage({ params }: PageProps<"/train/exercises/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit exercise" />
      <Suspense fallback={<PageSkeleton />}>
        <EditExercise params={params} />
      </Suspense>
    </>
  );
}

async function EditExercise({ params }: Pick<PageProps<"/train/exercises/[id]/edit">, "params">) {
  const { id } = await params;
  const { supabase } = await requireProfile(`/train/exercises/${id}/edit`);
  const exercise = await getExercise(supabase, id);
  if (!exercise?.user_id) notFound();
  return (
    <CustomExerciseForm
      exerciseId={id}
      initial={{
        name: exercise.name,
        equipment: (exercise.equipment ?? "") as (typeof EQUIPMENT)[number] | "",
        tracking_mode: exercise.tracking_mode,
        primary: exercise.muscles.filter((m) => m.role === "primary").map((m) => m.muscle_group),
        secondary: exercise.muscles.filter((m) => m.role === "secondary").map((m) => m.muscle_group),
      }}
    />
  );
}
