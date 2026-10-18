import { customExerciseSchema } from "@/lib/workouts/exercise-schema";
import { deleteCustomExercise, getExercise, updateCustomExercise } from "@/server/workouts/exercises";
import { WorkoutError } from "@/server/workouts/errors";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => {
    const exercise = await getExercise(supabase, (await params).id);
    if (!exercise) throw new WorkoutError("not_found", "Exercise not found");
    return json({ exercise });
  });
}

export function PATCH(request: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => {
    await updateCustomExercise(supabase, (await params).id, await readJson(request, customExerciseSchema));
    return json({ ok: true });
  });
}

export function DELETE(_: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => json({ result: await deleteCustomExercise(supabase, (await params).id) }));
}
