import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { InvalidAiKeyError, MissingAiKeyError } from "@/server/ai/client";
import { CoachError } from "./errors";

export function mapCoachAiError(error: unknown, feature: string): never {
  if (error instanceof MissingAiKeyError) throw new CoachError("missing_ai_key", `${feature} needs your Anthropic API key. Add it in Settings.`);
  if (error instanceof InvalidAiKeyError) throw new CoachError("ai_key_invalid", "Anthropic no longer accepts your API key. Update it in Settings.");
  if (error instanceof Anthropic.APIError) throw new CoachError("ai_unavailable", `${feature} isn't available right now. Please try again shortly.`);
  throw error;
}
