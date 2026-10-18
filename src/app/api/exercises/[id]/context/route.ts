import { exerciseContext } from "@/server/workouts/context";
import { WorkoutError } from "@/server/workouts/errors";
import { json, withWorkoutUser } from "@/server/workouts/route";
import { getActiveSession } from "@/server/workouts/sessions";

export function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withWorkoutUser(async ({ supabase, profile }) => {
    const active = await getActiveSession(supabase);
    const context = await exerciseContext(supabase, profile, (await params).id, active?.id ?? null);
    if (!context) throw new WorkoutError("not_found", "Exercise not found");
    return json(context);
  });
}
