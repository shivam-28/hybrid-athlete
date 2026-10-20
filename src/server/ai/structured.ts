import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AiRefusalError, aiMetaOf } from "./client";

/** Satisfied by both Anthropic and Foundry clients (Foundry only omits batch APIs). */
export type StructuredClient = { beta: { messages: Pick<Anthropic["beta"]["messages"], "parse"> } };
type Content = Anthropic.Beta.BetaContentBlockParam[];

/**
 * One structured-output call on the user's main model: Zod-shaped output via
 * output_config.format (forced tool use is rejected on Opus 5.5), medium effort.
 * Server-side refusal fallbacks are requested on Anthropic only (unsupported on Foundry).
 * Throws AiRefusalError when Claude declines; returns null on unparsable output;
 * API errors propagate for the caller to map.
 */
export async function parseStructured<S extends z.ZodType>(
  client: StructuredClient,
  request: { system: string; content: Content; schema: S; maxTokens: number },
): Promise<z.infer<S> | null> {
  const { provider, models } = aiMetaOf(client);
  const response = await client.beta.messages.parse({
    model: models.main,
    max_tokens: request.maxTokens,
    ...(provider === "anthropic" ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: request.system,
    output_config: { effort: "medium", format: betaZodOutputFormat(request.schema) },
    messages: [{ role: "user", content: request.content }],
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError();
  if (!response.parsed_output) return null;
  return response.parsed_output as z.infer<S>;
}
