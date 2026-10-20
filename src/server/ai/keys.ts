import "server-only";
import { isValidDeploymentName, parseFoundryEndpoint } from "@/lib/ai/foundry-endpoint";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { createAdminClient } from "@/server/supabase-admin";
import { AI_MODEL_DEFAULTS } from "./models";
import { verifyAnthropicKey, verifyFoundryKey, type KeyVerification } from "./verify-key";

// user_ai_keys has RLS with no policies: only this module (service role) can touch it.

export type AiProvider = "anthropic" | "foundry";

/** What the user submits. Foundry deployment names default to the model IDs. */
export type AiCredentialsInput =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "foundry"; apiKey: string; endpoint: string; mainDeployment?: string; fastDeployment?: string };

/** Validated, normalised credentials, as verified and stored. */
export type AiCredentials =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "foundry"; apiKey: string; resource: string; endpoint: string; mainDeployment: string; fastDeployment: string };

export type SaveVerdict = KeyVerification | "invalid_endpoint" | "invalid_deployment";
export type AiKeyStatus = { provider: AiProvider; last4: string; addedAt: string; invalid: boolean; endpointHost: string | null };

export function verifyCredentials(credentials: AiCredentials): Promise<KeyVerification> {
  return credentials.provider === "foundry"
    ? verifyFoundryKey(credentials)
    : verifyAnthropicKey(credentials.apiKey);
}

function normalise(input: AiCredentialsInput): AiCredentials | "invalid_endpoint" | "invalid_deployment" {
  const apiKey = input.apiKey.trim();
  if (input.provider === "anthropic") return { provider: "anthropic", apiKey };

  const parsed = parseFoundryEndpoint(input.endpoint);
  if (!parsed) return "invalid_endpoint";
  const mainDeployment = input.mainDeployment?.trim() || AI_MODEL_DEFAULTS.main;
  const fastDeployment = input.fastDeployment?.trim() || AI_MODEL_DEFAULTS.fast;
  if (!isValidDeploymentName(mainDeployment) || !isValidDeploymentName(fastDeployment)) return "invalid_deployment";
  return { provider: "foundry", apiKey, ...parsed, mainDeployment, fastDeployment };
}

/** Validates locally, verifies with the provider, and stores only on success. A plain string is an Anthropic key. */
export async function saveAiKey(
  userId: string,
  input: AiCredentialsInput | string,
  verify: (credentials: AiCredentials) => Promise<KeyVerification> = verifyCredentials,
): Promise<SaveVerdict> {
  const credentials = normalise(typeof input === "string" ? { provider: "anthropic", apiKey: input } : input);
  if (typeof credentials === "string") return credentials;
  const verdict = await verify(credentials);
  if (verdict !== "valid") return verdict;

  const foundry = credentials.provider === "foundry" ? credentials : null;
  const { error } = await createAdminClient()
    .from("user_ai_keys")
    .upsert({
      user_id: userId,
      ...encryptSecret(credentials.apiKey),
      last4: credentials.apiKey.slice(-4),
      provider: credentials.provider,
      // Defaults are stored as null so a future default change applies automatically.
      endpoint: foundry?.endpoint ?? null,
      main_deployment: foundry && foundry.mainDeployment !== AI_MODEL_DEFAULTS.main ? foundry.mainDeployment : null,
      fast_deployment: foundry && foundry.fastDeployment !== AI_MODEL_DEFAULTS.fast ? foundry.fastDeployment : null,
      invalid_at: null,
      created_at: new Date().toISOString(),
    });
  if (error) throw new Error("Failed to store AI key");
  return "valid";
}

export async function getAiKeyStatus(userId: string): Promise<AiKeyStatus | null> {
  const { data } = await createAdminClient()
    .from("user_ai_keys")
    .select("provider, endpoint, last4, created_at, invalid_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider as AiProvider,
    last4: data.last4,
    addedAt: data.created_at,
    invalid: data.invalid_at !== null,
    endpointHost: data.endpoint ? new URL(data.endpoint).hostname : null,
  };
}

export async function deleteAiKey(userId: string): Promise<void> {
  const { error } = await createAdminClient().from("user_ai_keys").delete().eq("user_id", userId);
  if (error) throw new Error("Failed to delete AI key");
}

/** Decrypted credentials for server-side AI calls, or null when the user has none. Never send these to a client. */
export async function readAiCredentials(userId: string): Promise<AiCredentials | null> {
  const { data } = await createAdminClient()
    .from("user_ai_keys")
    .select("ciphertext, iv, auth_tag, key_version, provider, endpoint, main_deployment, fast_deployment")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const apiKey = decryptSecret(data);
  if (data.provider !== "foundry") return { provider: "anthropic", apiKey };
  const parsed = parseFoundryEndpoint(data.endpoint ?? "");
  if (!parsed) throw new Error("Stored Foundry endpoint is invalid");
  return {
    provider: "foundry",
    apiKey,
    ...parsed,
    mainDeployment: data.main_deployment ?? AI_MODEL_DEFAULTS.main,
    fastDeployment: data.fast_deployment ?? AI_MODEL_DEFAULTS.fast,
  };
}

export async function markAiKeyInvalid(userId: string): Promise<void> {
  await createAdminClient().from("user_ai_keys").update({ invalid_at: new Date().toISOString() }).eq("user_id", userId);
}
