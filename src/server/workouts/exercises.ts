import "server-only";
import { customExerciseSchema, type CustomExerciseInput } from "@/lib/workouts/exercise-schema";
import { normaliseExerciseText } from "@/lib/workouts/normalise";
import type { MuscleGroup, MuscleRole } from "@/lib/workouts/types";
import { z } from "zod";
import type { Db, ExerciseRow } from "./db";
import { WorkoutError } from "./errors";

export type ExerciseMuscle = { muscle_group: MuscleGroup; role: MuscleRole };
export type ExerciseWithMuscles = ExerciseRow & { muscles: ExerciseMuscle[] };

export async function searchExercises(
  db: Db,
  params: { q?: string; muscle?: MuscleGroup | null; equipment?: string | null; limit?: number },
) {
  const { data, error } = await db.rpc("match_exercises", {
    p_query: normaliseExerciseText(params.q ?? ""),
    p_limit: params.limit ?? 30,
    ...(params.muscle && { p_muscle: params.muscle }),
    ...(params.equipment && { p_equipment: params.equipment }),
  });
  if (error) throw new Error(`Exercise search failed: ${error.message}`);
  return data;
}

export async function getExercise(db: Db, id: string): Promise<ExerciseWithMuscles | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await db
    .from("exercises")
    .select("*, exercise_muscles(muscle_group, role)")
    .eq("id", id)
    .order("role", { referencedTable: "exercise_muscles" })
    .order("muscle_group", { referencedTable: "exercise_muscles" })
    .maybeSingle();
  if (!data) return null;
  const { exercise_muscles, ...exercise } = data;
  return { ...exercise, muscles: exercise_muscles };
}

function parseCustom(input: CustomExerciseInput) {
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) throw new WorkoutError("invalid", "Check the exercise details.", z.flattenError(parsed.error).fieldErrors);
  const { primary, secondary, ...fields } = parsed.data;
  const muscles = [
    ...primary.map((muscle_group) => ({ muscle_group, role: "primary" as const })),
    ...secondary.filter((g) => !primary.includes(g)).map((muscle_group) => ({ muscle_group, role: "secondary" as const })),
  ];
  return { fields: { ...fields, search_name: normaliseExerciseText(fields.name) }, muscles };
}

async function replaceMuscles(db: Db, exerciseId: string, muscles: ExerciseMuscle[]) {
  await db.from("exercise_muscles").delete().eq("exercise_id", exerciseId);
  const { error } = await db.from("exercise_muscles").insert(muscles.map((m) => ({ ...m, exercise_id: exerciseId })));
  if (error) throw new Error(`Failed to save muscle groups: ${error.message}`);
}

async function requireOwnCustom(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) throw new WorkoutError("not_found", "Exercise not found");
  const { data } = await db.from("exercises").select("id").eq("id", id).not("user_id", "is", null).maybeSingle();
  if (!data) throw new WorkoutError("not_found", "Exercise not found");
}

export async function createCustomExercise(db: Db, input: CustomExerciseInput): Promise<ExerciseRow> {
  const { fields, muscles } = parseCustom(input);
  const { data, error } = await db.from("exercises").insert(fields).select().single();
  if (error) throw new Error(`Failed to create exercise: ${error.message}`);
  try {
    await replaceMuscles(db, data.id, muscles);
  } catch (e) {
    await db.from("exercises").delete().eq("id", data.id);
    throw e;
  }
  return data;
}

export async function updateCustomExercise(db: Db, id: string, input: CustomExerciseInput): Promise<void> {
  await requireOwnCustom(db, id);
  const { fields, muscles } = parseCustom(input);
  const { error } = await db.from("exercises").update(fields).eq("id", id);
  if (error) throw new Error(`Failed to update exercise: ${error.message}`);
  await replaceMuscles(db, id, muscles);
}

/** Exercises with logged history are archived (hidden, history kept); unused ones are deleted. */
export async function deleteCustomExercise(db: Db, id: string): Promise<"archived" | "deleted"> {
  await requireOwnCustom(db, id);
  const { count } = await db.from("workout_sets").select("id", { count: "exact", head: true }).eq("exercise_id", id);
  if ((count ?? 0) > 0) {
    await db.from("exercises").update({ archived_at: new Date().toISOString() }).eq("id", id);
    return "archived";
  }
  const { error } = await db.from("exercises").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete exercise: ${error.message}`);
  return "deleted";
}
