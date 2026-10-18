import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type KeyVerification = "valid" | "rejected" | "unavailable";

const KEY_SHAPE = /^sk-ant-[A-Za-z0-9_-]{8,}$/;

/** Checks a key against Anthropic's models endpoint, which authenticates without spending tokens. */
export async function verifyAnthropicKey(apiKey: string, fetchImpl?: typeof fetch): Promise<KeyVerification> {
  if (!KEY_SHAPE.test(apiKey.trim())) return "rejected";
  const client = new Anthropic({ apiKey: apiKey.trim(), fetch: fetchImpl, maxRetries: 0, timeout: 10_000 });
  try {
    await client.models.list({ limit: 1 });
    return "valid";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return "rejected";
    }
    return "unavailable";
  }
}
