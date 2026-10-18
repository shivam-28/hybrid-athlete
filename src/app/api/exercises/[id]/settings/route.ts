import { WorkoutError } from "@/server/workouts/errors";
import { getExercise } from "@/server/workouts/exercises";
import { json, readJson, withWorkoutUser } from "@/server/workouts/route";
import { clearProgressionSettings, progressionSettingsSchema, saveProgressionSettings } from "@/server/workouts/settings";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(request: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => {
    const { id } = await params;
    if (!(await getExercise(supabase, id))) throw new WorkoutError("not_found", "Exercise not found");
    await saveProgressionSettings(supabase, id, await readJson(request, progressionSettingsSchema));
    return json({ ok: true });
  });
}

export function DELETE(_: Request, { params }: Ctx) {
  return withWorkoutUser(async ({ supabase }) => {
    await clearProgressionSettings(supabase, (await params).id);
    return json({ ok: true });
  });
}
