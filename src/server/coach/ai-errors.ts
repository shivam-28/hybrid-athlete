import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_DECLINED_MESSAGE, AiRefusalError, InvalidAiKeyError, MissingAiKeyError } from "@/server/ai/client";
import { CoachError } from "./errors";

export function mapCoachAiError(error: unknown, feature: string): never {
  if (error instanceof MissingAiKeyError) throw new CoachError("missing_ai_key", `${feature} needs your AI key. Add it in Settings.`);
  if (error instanceof InvalidAiKeyError) throw new CoachError("ai_key_invalid", "Your AI provider no longer accepts your key. Update it in Settings.");
  if (error instanceof AiRefusalError) throw new CoachError("ai_declined", AI_DECLINED_MESSAGE);
  if (error instanceof Anthropic.APIError) throw new CoachError("ai_unavailable", `${feature} isn't available right now. Please try again shortly.`);
  throw error;
}
