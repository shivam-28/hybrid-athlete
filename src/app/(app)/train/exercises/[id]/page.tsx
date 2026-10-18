import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteExerciseButton } from "@/components/workouts/delete-exercise-button";
import { ProgressionSettingsForm } from "@/components/workouts/progression-settings-form";
import { exerciseImageUrl } from "@/lib/exercises/images";
import type { UnitSystem } from "@/lib/units";
import { bestSet, estimatedOneRepMax, formatSetValues } from "@/lib/workouts/history";
import { progressionDefaults } from "@/lib/workouts/progression";
import { MUSCLE_LABELS, TRACKING_MODE_LABELS } from "@/lib/workouts/types";
import { requireProfile } from "@/server/auth";
import { getExercise } from "@/server/workouts/exercises";
import { exerciseHistory } from "@/server/workouts/history";
import { getProgressionSettings } from "@/server/workouts/settings";

export const metadata: Metadata = { title: "Exercise" };

export default function ExercisePage({ params }: PageProps<"/train/exercises/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExerciseDetail params={params} />
    </Suspense>
  );
}

async function ExerciseDetail({ params }: Pick<PageProps<"/train/exercises/[id]">, "params">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(`/train/exercises/${id}`);
  const exercise = await getExercise(supabase, id);
  if (!exercise) notFound();
  const units = profile.unit_system as UnitSystem;
  const [history, settings] = await Promise.all([exerciseHistory(supabase, id), getProgressionSettings(supabase, id)]);
  const allSets = history.flatMap((h) => h.sets);
  const best = exercise.tracking_mode === "weight_reps" ? bestSet(allSets) : null;
  const primary = exercise.muscles.filter((m) => m.role === "primary");
  const secondary = exercise.muscles.filter((m) => m.role === "secondary");

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{exercise.name}</h1>
        <div className="flex flex-wrap gap-2">
          {exercise.user_id && <Badge>Custom</Badge>}
          {exercise.archived_at && <Badge variant="secondary">Archived</Badge>}
          <Badge variant="outline">{TRACKING_MODE_LABELS[exercise.tracking_mode]}</Badge>
          {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
          {exercise.level && <Badge variant="outline">{exercise.level}</Badge>}
        </div>
        <dl className="grid grid-cols-[6rem_1fr] gap-1 text-sm">
          <dt className="text-muted-foreground">Primary</dt>
          <dd>{primary.map((m) => MUSCLE_LABELS[m.muscle_group]).join(", ")}</dd>
          {secondary.length > 0 && (
            <>
              <dt className="text-muted-foreground">Secondary</dt>
              <dd>{secondary.map((m) => MUSCLE_LABELS[m.muscle_group]).join(", ")}</dd>
            </>
          )}
        </dl>
        {exercise.user_id && !exercise.archived_at && (
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link href={`/train/exercises/${id}/edit`}>Edit</Link>
            </Button>
            <DeleteExerciseButton exerciseId={id} />
          </div>
        )}
      </header>

      {exercise.image_paths.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {exercise.image_paths.slice(0, 2).map((path, i) => (
            <Image
              key={path}
              src={exerciseImageUrl(path)}
              alt={`${exercise.name}, position ${i + 1}`}
              width={400}
              height={300}
              className="h-auto w-full rounded-md border"
            />
          ))}
        </div>
      )}

      {exercise.instructions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {history.length === 0 && <p className="text-muted-foreground">Not logged yet.</p>}
          {best && (
            <p>
              Best set: <strong>{formatSetValues(best, units)}</strong> (est. 1RM {estimatedOneRepMax(best.weight_kg!, best.reps!).toFixed(1)} kg)
            </p>
          )}
          <ul className="divide-y">
            {history.map((h) => (
              <li key={h.sessionId} className="py-2">
                <Link href={`/train/history/${h.sessionId}`} className="text-muted-foreground text-xs hover:underline">
                  {h.localDate}
                </Link>
                <p>
                  {h.sets.map((s) => (
                    <span key={s.id} className={s.id === best?.id ? "font-semibold" : undefined} data-best={s.id === best?.id || undefined}>
                      {formatSetValues(s, units, exercise.tracking_mode)}
                      {s.id === best?.id && " ★"}
                      {"  "}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progression</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressionSettingsForm exerciseId={id} mode={exercise.tracking_mode} settings={settings} defaults={progressionDefaults(exercise)} />
        </CardContent>
      </Card>
    </>
  );
}
