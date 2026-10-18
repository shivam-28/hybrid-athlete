import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { validateSetForMode } from "@/lib/workouts/set-schema";
import type { TrackingMode } from "@/lib/workouts/types";
import { AI_MODELS } from "@/server/ai/client";

export type AiClient = Pick<Anthropic, "messages">;
export type AiCandidate = { id: string; name: string; tracking_mode: TrackingMode };
export type DraftSet = { weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null };
export type AiParseInput = { transcript: string; candidates: AiCandidate[]; activeExerciseName: string | null; unit: "kg" | "lb" };

// Ranges are checked after parsing (validateSetForMode); the schema only fixes the shape.
const outputSchema = z.object({
  exercise_id: z.string(),
  sets: z.array(
    z.object({
      weight_kg: z.number().nullable(),
      reps: z.number().int().nullable(),
      duration_s: z.number().int().nullable(),
      distance_m: z.number().nullable(),
    }),
  ),
});

const SYSTEM = `You turn a gym-goer's spoken workout log into structured sets.
Pick exercise_id only from the candidate list. Weights must be in kilograms (convert pounds: 1 lb = 0.45359237 kg).
Use null for values that were not said. Bodyweight exercises have weight_kg null unless extra weight was added.
If the phrase says "N sets of", return N identical sets.`;

/**
 * Last-resort parse for phrases the grammar and fuzzy matcher could not resolve.
 * Returns null when the model's answer is unusable; provider errors propagate.
 */
export async function aiParseUtterance(client: AiClient, input: AiParseInput): Promise<{ exerciseId: string; sets: DraftSet[] } | null> {
  const response = await client.messages.parse(
    {
      model: AI_MODELS.fast,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            transcript: input.transcript,
            user_weight_unit: input.unit,
            exercise_open_in_app: input.activeExerciseName,
            candidates: input.candidates.map((c) => ({ id: c.id, name: c.name, tracking_mode: c.tracking_mode })),
          }),
        },
      ],
      output_config: { format: zodOutputFormat(outputSchema) },
    },
    { timeout: 8000, maxRetries: 0 },
  );
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;

  const { exercise_id, sets } = response.parsed_output;
  const exercise = input.candidates.find((c) => c.id === exercise_id);
  if (!exercise || sets.length === 0 || sets.length > 10) return null;
  const validated = sets.map((s) => validateSetForMode(exercise.tracking_mode, s));
  if (validated.some((v) => !v.success)) return null;
  return {
    exerciseId: exercise.id,
    sets: validated.map((v) => {
      const { weight_kg, reps, duration_s, distance_m } = (v as { success: true; data: DraftSet }).data;
      return { weight_kg, reps, duration_s, distance_m };
    }),
  };
}
