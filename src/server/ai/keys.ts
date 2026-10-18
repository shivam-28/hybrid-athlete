import "server-only";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { createAdminClient } from "@/server/supabase-admin";
import { verifyAnthropicKey, type KeyVerification } from "./verify-key";

// user_ai_keys has RLS with no policies: only this module (service role) can touch it.

export type AiKeyStatus = { last4: string; addedAt: string; invalid: boolean };

export async function saveAiKey(
  userId: string,
  apiKey: string,
  verify: (key: string) => Promise<KeyVerification> = verifyAnthropicKey,
): Promise<KeyVerification> {
  const key = apiKey.trim();
  const verdict = await verify(key);
  if (verdict !== "valid") return verdict;

  const { error } = await createAdminClient()
    .from("user_ai_keys")
    .upsert({ user_id: userId, ...encryptSecret(key), last4: key.slice(-4), invalid_at: null, created_at: new Date().toISOString() });
  if (error) throw new Error("Failed to store AI key");
  return "valid";
}

export async function getAiKeyStatus(userId: string): Promise<AiKeyStatus | null> {
  const { data } = await createAdminClient()
    .from("user_ai_keys")
    .select("last4, created_at, invalid_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { last4: data.last4, addedAt: data.created_at, invalid: data.invalid_at !== null } : null;
}

export async function deleteAiKey(userId: string): Promise<void> {
  const { error } = await createAdminClient().from("user_ai_keys").delete().eq("user_id", userId);
  if (error) throw new Error("Failed to delete AI key");
}

/** Decrypted key for server-side AI calls, or null when the user has none. Never send this to a client. */
export async function readAiKey(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("user_ai_keys")
    .select("ciphertext, iv, auth_tag, key_version")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? decryptSecret(data) : null;
}

export async function markAiKeyInvalid(userId: string): Promise<void> {
  await createAdminClient().from("user_ai_keys").update({ invalid_at: new Date().toISOString() }).eq("user_id", userId);
}
