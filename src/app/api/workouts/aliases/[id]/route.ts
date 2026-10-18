import { json, withWorkoutUser } from "@/server/workouts/route";
import { deleteAlias } from "@/server/workouts/settings";

export function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withWorkoutUser(async ({ supabase }) => {
    await deleteAlias(supabase, (await params).id);
    return json({ ok: true });
  });
}
