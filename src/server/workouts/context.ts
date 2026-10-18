import "server-only";
import { formatSetsSummary } from "@/lib/workouts/history";
import { progressionDefaults, suggestNext } from "@/lib/workouts/progression";
import type { Profile } from "@/server/auth";
import type { Db } from "./db";
import { getExercise } from "./exercises";
import { previousPerformance, recentWorkingSets } from "./history";
import { getProgressionSettings } from "./settings";

/** What the logging UI shows when an exercise is opened: last time, today's suggestion, settings. */
export async function exerciseContext(db: Db, profile: Profile, exerciseId: string, currentSessionId: string | null) {
  const exercise = await getExercise(db, exerciseId);
  if (!exercise) return null;
  const units = profile.unit_system as "metric" | "imperial";
  const [previous, recent, settings] = await Promise.all([
    previousPerformance(db, exerciseId, currentSessionId),
    recentWorkingSets(db, exerciseId, currentSessionId, 3),
    getProgressionSettings(db, exerciseId),
  ]);
  return {
    exercise: { id: exercise.id, name: exercise.name, tracking_mode: exercise.tracking_mode, equipment: exercise.equipment },
    previous: previous
      ? { localDate: previous.localDate, summary: formatSetsSummary(previous.sets, units, exercise.tracking_mode) }
      : null,
    suggestion: suggestNext(exercise, settings, recent),
    settings,
    defaults: progressionDefaults(exercise),
  };
}
export type ExerciseContext = NonNullable<Awaited<ReturnType<typeof exerciseContext>>>;
