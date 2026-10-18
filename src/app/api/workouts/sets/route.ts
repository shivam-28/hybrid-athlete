import { newSetBody } from "@/server/workouts/request-schemas";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { addSet } from "@/server/workouts/sessions";

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase, profile }) => json({ set: await addSet(supabase, profile, await readJson(request, newSetBody)) }, 201));
}
