import { voiceBody } from "@/server/workouts/request-schemas";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { processUtterance, userAiFallback } from "@/server/workouts/voice";

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase, profile, user }) =>
    json(await processUtterance(supabase, profile, await readJson(request, voiceBody), userAiFallback(user.id))),
  );
}
