import "server-only";
import { z } from "zod";
import type { Db } from "./db";
import { WorkoutError } from "./errors";

export const progressionSettingsSchema = z
  .object({
    rep_min: z.number().int().min(1).max(100).nullable(),
    rep_max: z.number().int().min(1).max(100).nullable(),
    increment_kg: z.number().min(0.25).max(50).nullable(),
    duration_increment_s: z.number().int().min(1).max(600).nullable(),
  })
  .refine((s) => s.rep_min === null || s.rep_max === null || s.rep_min <= s.rep_max, {
    message: "Minimum reps must not exceed maximum reps",
    path: ["rep_max"],
  });
export type ProgressionSettingsInput = z.infer<typeof progressionSettingsSchema>;

export async function getProgressionSettings(db: Db, exerciseId: string) {
  const { data } = await db
    .from("exercise_settings")
    .select("rep_min, rep_max, increment_kg, duration_increment_s")
    .eq("exercise_id", exerciseId)
    .maybeSingle();
  return data;
}

export async function saveProgressionSettings(db: Db, exerciseId: string, input: ProgressionSettingsInput) {
  const parsed = progressionSettingsSchema.safeParse(input);
  if (!parsed.success) throw new WorkoutError("invalid", "Check the progression settings.", z.flattenError(parsed.error).fieldErrors);
  const { error } = await db.from("exercise_settings").upsert({ exercise_id: exerciseId, ...parsed.data }, { onConflict: "user_id,exercise_id" });
  if (error) throw new WorkoutError("not_found", "Exercise not found");
}

export async function clearProgressionSettings(db: Db, exerciseId: string) {
  await db.from("exercise_settings").delete().eq("exercise_id", exerciseId);
}

export async function listAliases(db: Db) {
  const { data } = await db.from("exercise_aliases").select("id, phrase_normalised, exercises(name)").order("phrase_normalised");
  return (data ?? []).map((a) => ({ id: a.id, phrase: a.phrase_normalised, exerciseName: a.exercises.name }));
}

export async function deleteAlias(db: Db, id: string) {
  await db.from("exercise_aliases").delete().eq("id", id);
}
