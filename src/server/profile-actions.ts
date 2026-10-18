"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseProfileInput, type ProfileInput } from "@/lib/profile-schema";
import { localDate } from "@/lib/time";
import { recomputeActivityZones } from "./activities/activities";
import { requireUser } from "./auth";

export type ProfileFormState = {
  ok?: boolean;
  fieldErrors?: Partial<Record<keyof ProfileInput, string[]>>;
  formError?: string;
};

async function save(path: string, formData: FormData): Promise<ProfileFormState> {
  const { supabase, user, profile } = await requireUser(path);
  const input = Object.fromEntries(formData);
  const result = parseProfileInput(input, localDate(new Date(), String(input.timezone ?? "")));
  if (!result.success) return { fieldErrors: result.fieldErrors };

  // Settings always sends max_hr_bpm; blank there means "estimate from age" (null).
  const values = formData.has("max_hr_bpm") ? { ...result.data, max_hr_bpm: result.data.max_hr_bpm ?? null } : result.data;
  const { data: saved, error } = await supabase.from("profiles").upsert({ user_id: user.id, ...values }).select("*").single();
  if (error) return { formError: "Could not save your profile. Please try again." };

  const maxHrInputsChanged =
    profile && (profile.max_hr_bpm !== saved.max_hr_bpm || profile.birth_date !== saved.birth_date);
  if (maxHrInputsChanged) await recomputeActivityZones(supabase, saved);
  return { ok: true };
}

export async function completeOnboarding(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const state = await save("/onboarding", formData);
  if (state.ok) redirect("/today");
  return state;
}

export async function updateProfile(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const state = await save("/settings", formData);
  if (state.ok) revalidatePath("/", "layout");
  return state;
}
