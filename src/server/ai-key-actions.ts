"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { deleteAiKey, saveAiKey, type AiCredentialsInput, type SaveVerdict } from "./ai/keys";
import { AI_MODELS } from "./ai/client";

export type AiKeyFormState = { message?: string; error?: string };

function messageFor(verdict: Exclude<SaveVerdict, "valid">, input: AiCredentialsInput): string {
  const foundry = input.provider === "foundry";
  switch (verdict) {
    case "rejected":
      return foundry
        ? "Foundry rejected that key. Copy Key 1 or Key 2 from your Foundry resource's Keys and Endpoint page."
        : "Anthropic rejected that key. Check it was copied completely from console.anthropic.com.";
    case "unavailable":
      return `Couldn't reach ${foundry ? "Microsoft Foundry" : "Anthropic"} to check the key. Nothing was saved. Please try again in a moment.`;
    case "deployment_not_found":
      return `Foundry has no deployment named "${(foundry && input.mainDeployment?.trim()) || AI_MODELS.main}" in that resource. Deploy it, or enter the name you used.`;
    case "invalid_endpoint":
      return "Use your Foundry endpoint exactly as shown in Azure, like https://your-resource.services.ai.azure.com/anthropic";
    case "invalid_deployment":
      return "Deployment names may only use letters, digits, '.', '_' and '-' (up to 64 characters).";
  }
}

function readCredentials(formData: FormData): AiCredentialsInput {
  const field = (name: string) => String(formData.get(name) ?? "");
  const apiKey = field("api_key");
  if (field("provider") !== "foundry") return { provider: "anthropic", apiKey };
  return {
    provider: "foundry",
    apiKey,
    endpoint: field("endpoint"),
    mainDeployment: field("main_deployment"),
    fastDeployment: field("fast_deployment"),
  };
}

export async function saveAiKeyAction(_: AiKeyFormState, formData: FormData): Promise<AiKeyFormState> {
  const { user } = await requireUser("/settings");
  const input = readCredentials(formData);
  const verdict = await saveAiKey(user.id, input);
  if (verdict !== "valid") return { error: messageFor(verdict, input) };
  revalidatePath("/settings");
  return { message: "Key saved." };
}

export async function deleteAiKeyAction(): Promise<void> {
  const { user } = await requireUser("/settings");
  await deleteAiKey(user.id);
  revalidatePath("/settings");
}
