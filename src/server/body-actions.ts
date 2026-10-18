"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { BodyError } from "./body/errors";
import { setGoal } from "./body/goals";
import { setPhotoAiConsent } from "./body/photos";
import { addMeasurement, addWeight, deleteWeight, updateWeight } from "./body/weights";

export type BodyFormState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[] | undefined> };

async function run(path: string, fn: () => Promise<unknown>, okMessage: string): Promise<BodyFormState> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof BodyError) return { message: error.message, fieldErrors: error.fieldErrors };
    throw error;
  }
  revalidatePath(path);
  revalidatePath("/today");
  return { ok: true, message: okMessage };
}

export async function addWeightAction(_: BodyFormState, formData: FormData): Promise<BodyFormState> {
  const { supabase, profile } = await requireProfile("/body");
  return run("/body", () => addWeight(supabase, profile, Object.fromEntries(formData)), "Weight saved.");
}

export async function updateWeightAction(id: string, _: BodyFormState, formData: FormData): Promise<BodyFormState> {
  const { supabase, profile } = await requireProfile("/body");
  return run("/body", () => updateWeight(supabase, profile, id, Object.fromEntries(formData)), "Weight updated.");
}

export async function deleteWeightAction(id: string): Promise<void> {
  const { supabase } = await requireProfile("/body");
  await deleteWeight(supabase, id);
  revalidatePath("/body");
  revalidatePath("/today");
}

export async function addMeasurementAction(_: BodyFormState, formData: FormData): Promise<BodyFormState> {
  const { supabase, profile } = await requireProfile("/body/measurements");
  return run("/body/measurements", () => addMeasurement(supabase, profile, Object.fromEntries(formData)), "Measurements saved.");
}

export async function setPhotoAiConsentAction(consent: boolean): Promise<void> {
  const { supabase, user } = await requireProfile("/settings");
  await setPhotoAiConsent(supabase, user.id, consent);
  revalidatePath("/settings");
  revalidatePath("/body/photos");
}

export async function setGoalAction(_: BodyFormState, formData: FormData): Promise<BodyFormState> {
  const { supabase, profile } = await requireProfile("/body/goal");
  return run("/body/goal", () => setGoal(supabase, profile, Object.fromEntries(formData)), "Goal saved.");
}
