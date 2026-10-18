import { z } from "zod";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { repeatLastSet } from "@/server/workouts/sessions";

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase, profile }) => {
    const { exercise_id } = await readJson(request, z.object({ exercise_id: z.uuid().nullable().optional() }));
    return json({ set: await repeatLastSet(supabase, profile, exercise_id ?? null) }, 201);
  });
}
