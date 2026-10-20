import "server-only";
import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";

// Every option is explicit: both SDKs otherwise fall back to process env
// (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_FOUNDRY_*), which could route a
// user's request to the server operator's endpoint or credentials.

type Extra = Pick<ClientOptions, "fetch" | "maxRetries" | "timeout">;

export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
export const foundryBaseUrl = (resource: string) => `https://${resource}.services.ai.azure.com/anthropic/`;

export function anthropicClient(apiKey: string, extra: Extra = {}): Anthropic {
  return new Anthropic({ apiKey, authToken: null, baseURL: ANTHROPIC_BASE_URL, ...extra });
}

/** `resource` must come from parseFoundryEndpoint; the URL is built here, never taken from input. */
export function foundryClient(resource: string, apiKey: string, extra: Extra = {}): AnthropicFoundry {
  return new AnthropicFoundry({ baseURL: foundryBaseUrl(resource), resource: "", apiKey, authToken: null, ...extra });
}
