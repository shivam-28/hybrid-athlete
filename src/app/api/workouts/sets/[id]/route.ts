import { setValuesSchema } from "@/lib/workouts/set-schema";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { deleteSet, updateSet } from "@/server/workouts/sessions";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(request: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => json({ set: await updateSet(supabase, (await params).id, await readJson(request, setValuesSchema)) }));
}

/** Also used by the voice toast's Undo. */
export function DELETE(_: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => {
    await deleteSet(supabase, (await params).id);
    return json({ ok: true });
  });
}
