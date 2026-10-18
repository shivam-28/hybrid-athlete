import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AI_MODELS } from "./client";

export type StructuredClient = Pick<Anthropic, "beta">;
type Content = Anthropic.Beta.BetaContentBlockParam[];

/**
 * One structured-output call on the main model (Opus 5.5): Zod-shaped output via
 * output_config.format (forced tool use is rejected on this model), medium effort,
 * and server-side refusal fallbacks. Returns null on a refusal or unparsable output;
 * API errors propagate for the caller to map.
 */
export async function parseStructured<S extends z.ZodType>(
  client: StructuredClient,
  request: { system: string; content: Content; schema: S; maxTokens: number },
): Promise<z.infer<S> | null> {
  const response = await client.beta.messages.parse({
    model: AI_MODELS.main,
    max_tokens: request.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: request.system,
    output_config: { effort: "medium", format: betaZodOutputFormat(request.schema) },
    messages: [{ role: "user", content: request.content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output as z.infer<S>;
}
