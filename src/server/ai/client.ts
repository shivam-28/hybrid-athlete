import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { markAiKeyInvalid, readAiCredentials, type AiProvider } from "./keys";
import { AI_MODEL_DEFAULTS } from "./models";
import { anthropicClient, foundryClient } from "./providers";

export const AI_MODELS = AI_MODEL_DEFAULTS;

/** Foundry clients omit the batch APIs; feature code only uses (beta.)messages.parse. */
export type AiClient = Anthropic | AnthropicFoundry;
export type AiModels = { main: string; fast: string };
export type AiMeta = { provider: AiProvider; models: AiModels };

const DEFAULT_META: AiMeta = { provider: "anthropic", models: AI_MODELS };
const META = new WeakMap<object, AiMeta>();

/** Provider and resolved model/deployment names for a client from getAnthropicClient (Anthropic defaults otherwise). */
export function aiMetaOf(client: object): AiMeta {
  return META.get(client) ?? DEFAULT_META;
}

/** Records how to address models on this client. Exported for tests that need a Foundry-flavoured double. */
export function registerAiMeta<T extends object>(client: T, meta: AiMeta): T {
  META.set(client, meta);
  return client;
}

export class MissingAiKeyError extends Error {
  constructor() {
    super("No AI key configured");
    this.name = "MissingAiKeyError";
  }
}

export class InvalidAiKeyError extends Error {
  constructor() {
    super("The stored AI key was rejected");
    this.name = "InvalidAiKeyError";
  }
}

export const AI_DECLINED_MESSAGE = "Claude declined this request. Try a different photo or wording.";

/** Claude declined the request (stop_reason "refusal"), after any provider-side fallback. */
export class AiRefusalError extends Error {
  constructor() {
    super("Claude declined this request");
    this.name = "AiRefusalError";
  }
}

export async function getAnthropicClient(userId: string): Promise<AiClient> {
  const credentials = await readAiCredentials(userId);
  if (!credentials) throw new MissingAiKeyError();
  if (credentials.provider === "foundry") {
    return registerAiMeta(foundryClient(credentials.resource, credentials.apiKey), {
      provider: "foundry",
      models: { main: credentials.mainDeployment, fast: credentials.fastDeployment },
    });
  }
  return registerAiMeta(anthropicClient(credentials.apiKey), DEFAULT_META);
}

/**
 * Runs an AI call with the user's own credentials. If the provider rejects them, flags
 * them as invalid (so Settings prompts for new ones) and throws InvalidAiKeyError.
 */
export async function withUserAnthropic<T>(userId: string, call: (client: AiClient) => Promise<T>): Promise<T> {
  const client = await getAnthropicClient(userId);
  try {
    return await call(client);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      await markAiKeyInvalid(userId);
      throw new InvalidAiKeyError();
    }
    throw error;
  }
}
