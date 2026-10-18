import { z } from "zod";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { startSession } from "@/server/workouts/sessions";

export function POST(request: Request) {
  return withWorkoutUser(async ({ supabase, profile }) => {
    const { finishActive } = await readJson(request, z.object({ finishActive: z.boolean().optional() }));
    return json(await startSession(supabase, profile, { finishActive }), 201);
  });
}
