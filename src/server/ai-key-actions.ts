"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { deleteAiKey, saveAiKey } from "./ai/keys";

export type AiKeyFormState = { message?: string; error?: string };

const MESSAGES = {
  valid: "Key saved.",
  rejected: "Anthropic rejected that key. Check it was copied completely from console.anthropic.com.",
  unavailable: "Couldn't reach Anthropic to check the key. Nothing was saved. Please try again in a moment.",
} as const;

export async function saveAiKeyAction(_: AiKeyFormState, formData: FormData): Promise<AiKeyFormState> {
  const { user } = await requireUser("/settings");
  const verdict = await saveAiKey(user.id, String(formData.get("api_key") ?? ""));
  if (verdict !== "valid") return { error: MESSAGES[verdict] };
  revalidatePath("/settings");
  return { message: MESSAGES.valid };
}

export async function deleteAiKeyAction(): Promise<void> {
  const { user } = await requireUser("/settings");
  await deleteAiKey(user.id);
  revalidatePath("/settings");
}
