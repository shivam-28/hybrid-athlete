import { json, withWorkoutUser } from "@/server/workouts/route";
import { reopenSession } from "@/server/workouts/sessions";

export function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withWorkoutUser(async ({ supabase }) => {
    await reopenSession(supabase, (await params).id);
    return json({ ok: true });
  });
}
