"use server";

import { revalidatePath } from "next/cache";
import { parsePreferences, type NutritionPreferences } from "@/lib/nutrition/preferences";
import { requireUser } from "./auth";

export type PreferencesFormState = {
  ok?: boolean;
  fieldErrors?: Partial<Record<keyof NutritionPreferences, string[]>>;
  formError?: string;
};

export async function updateNutritionPreferences(_: PreferencesFormState, formData: FormData): Promise<PreferencesFormState> {
  const { supabase, user } = await requireUser("/settings");
  const result = parsePreferences(Object.fromEntries(formData));
  if (!result.success) return { fieldErrors: result.fieldErrors };
  const { error } = await supabase.from("profiles").update(result.data).eq("user_id", user.id);
  if (error) return { formError: "Could not save your nutrition preferences. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
