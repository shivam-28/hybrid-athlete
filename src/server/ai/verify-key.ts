import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, foundryClient } from "./providers";

export type KeyVerification = "valid" | "rejected" | "unavailable" | "deployment_not_found";

const ANTHROPIC_KEY_SHAPE = /^sk-ant-[A-Za-z0-9_-]{8,}$/;
const FOUNDRY_KEY_SHAPE = /^\S{1,200}$/;

/** Checks a key against Anthropic's models endpoint, which authenticates without spending tokens. */
export async function verifyAnthropicKey(apiKey: string, fetchImpl?: typeof fetch): Promise<KeyVerification> {
  if (!ANTHROPIC_KEY_SHAPE.test(apiKey.trim())) return "rejected";
  const client = anthropicClient(apiKey.trim(), { fetch: fetchImpl, maxRetries: 0, timeout: 10_000 });
  try {
    await client.models.list({ limit: 1 });
    return "valid";
  } catch (error) {
    return classify(error);
  }
}

/**
 * Foundry has no Models API, so a token count against the main deployment proves both
 * the key and the deployment name without generating anything.
 */
export async function verifyFoundryKey(
  input: { resource: string; apiKey: string; mainDeployment: string },
  fetchImpl?: typeof fetch,
): Promise<KeyVerification> {
  if (!FOUNDRY_KEY_SHAPE.test(input.apiKey)) return "rejected";
  const client = foundryClient(input.resource, input.apiKey, { fetch: fetchImpl, maxRetries: 0, timeout: 10_000 });
  try {
    await client.messages.countTokens({ model: input.mainDeployment, messages: [{ role: "user", content: "ping" }] });
    return "valid";
  } catch (error) {
    if (error instanceof Anthropic.NotFoundError) return "deployment_not_found";
    return classify(error);
  }
}

function classify(error: unknown): KeyVerification {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "rejected";
  return "unavailable";
}
