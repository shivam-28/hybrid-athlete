import "server-only";
import { z } from "zod";
import { parseStructured, type StructuredClient } from "@/server/ai/structured";

export type AnalysisClient = StructuredClient;
export type PhotoInput = { base64: string; date: string };
export type PhotoAnalysis = { observations: string[]; visualImpression: string | null };

const outputSchema = z.object({
  observations: z.array(z.string()),
  visual_impression: z.string().nullable(),
});

const SYSTEM = `You compare two progress photos of the same person in the same pose, taken on different dates, for their own private fitness tracking.
Describe only observable changes: muscle definition, shape and proportions, posture. Be specific, neutral and encouraging; never judge attractiveness or health.
Write 2–6 short observations. If nothing visibly changed, say so.
Do not state a body fat percentage in the observations. Body fat cannot be measured from photos; if you offer a rough body fat range at all,
put it only in visual_impression (otherwise null).`;

/** A body-fat figure in an observation would read like a measurement; such lines are dropped. */
const BODY_FAT_FIGURE = /\d+(?:[.,]\d+)?\s*(?:%|percent)/i;

export async function analyzePhotoPair(client: AnalysisClient, before: PhotoInput, after: PhotoInput, pose: string): Promise<PhotoAnalysis | null> {
  const image = (p: PhotoInput) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: p.base64 } });
  const output = await parseStructured(client, {
    system: SYSTEM,
    schema: outputSchema,
    maxTokens: 2048,
    content: [
      { type: "text", text: `Earlier photo (${before.date}, ${pose}):` },
      image(before),
      { type: "text", text: `Later photo (${after.date}, ${pose}):` },
      image(after),
      { type: "text", text: "What visibly changed between the earlier and the later photo?" },
    ],
  });
  if (!output) return null;
  const observations = output.observations
    .map((o) => o.trim())
    .filter((o) => o && !BODY_FAT_FIGURE.test(o))
    .slice(0, 12);
  if (observations.length === 0) return null;
  return { observations, visualImpression: output.visual_impression?.trim() || null };
}
