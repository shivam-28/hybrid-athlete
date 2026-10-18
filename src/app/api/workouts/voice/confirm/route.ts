import { confirmBody } from "@/server/workouts/request-schemas";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { confirmUtterance } from "@/server/workouts/voice";

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase, profile }) => json(await confirmUtterance(supabase, profile, await readJson(request, confirmBody))));
}
