import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { markAiKeyInvalid, readAiKey } from "./keys";

/** `main` reads photos/documents and writes plans; `fast` parses short voice/text logs. */
export const AI_MODELS = {
  main: "claude-opus-5-5",
  fast: "claude-haiku-4-5",
} as const;

export class MissingAiKeyError extends Error {
  constructor() {
    super("No Anthropic API key configured");
    this.name = "MissingAiKeyError";
  }
}

export class InvalidAiKeyError extends Error {
  constructor() {
    super("The stored Anthropic API key was rejected");
    this.name = "InvalidAiKeyError";
  }
}

export async function getAnthropicClient(userId: string): Promise<Anthropic> {
  const apiKey = await readAiKey(userId);
  if (!apiKey) throw new MissingAiKeyError();
  return new Anthropic({ apiKey });
}

/**
 * Runs an AI call with the user's own key. If Anthropic rejects the key, flags it
 * as invalid (so Settings prompts for a new one) and throws InvalidAiKeyError.
 */
export async function withUserAnthropic<T>(userId: string, call: (client: Anthropic) => Promise<T>): Promise<T> {
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
