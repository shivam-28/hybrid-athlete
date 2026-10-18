import { z } from "zod";
import { customExerciseSchema } from "@/lib/workouts/exercise-schema";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/workouts/types";
import { createCustomExercise, searchExercises } from "@/server/workouts/exercises";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";

const query = z.object({
  q: z.string().max(100).optional(),
  muscle: z.enum(MUSCLE_GROUPS as [MuscleGroup, ...MuscleGroup[]]).optional(),
  equipment: z.string().max(40).optional(),
});

export function GET(request: Request) {
  return withWorkoutUser(async ({ supabase }) => {
    const params = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!params.success) return json({ error: "invalid" }, 422);
    return json({ exercises: await searchExercises(supabase, params.data) });
  });
}

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase }) => {
    const exercise = await createCustomExercise(supabase, await readJson(request, customExerciseSchema));
    return json({ exercise }, 201);
  });
}
