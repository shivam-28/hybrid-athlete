import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { checkConsistency, deriveComposition, type ConsistencyWarning } from "@/lib/body/composition";
import { AI_DECLINED_MESSAGE, AiRefusalError, InvalidAiKeyError, MissingAiKeyError, withUserAnthropic } from "@/server/ai/client";
import { ImageError } from "@/server/images/normalize";
import { BodyError } from "./errors";
import { extractBodyComposition, type ExtractionClient, type ExtractionDraft } from "./extract";
import { createPdfUpload, ownsPath, removeFile, storeImage } from "./uploads";
import type { Db } from "./weights";

export type RunAi = <T>(call: (client: ExtractionClient) => Promise<T>) => Promise<T>;
export const userAi = (userId: string): RunAi => (call) => withUserAnthropic(userId, call);

export type ExtractionResponse =
  | { kind: "draft"; draft: ExtractionDraft; notFound: string[]; warnings: ConsistencyWarning[] }
  | { kind: "empty" }
  | { kind: "unreadable" };

export async function uploadReportImage(db: Db, userId: string, bytes: Uint8Array) {
  try {
    return await storeImage(db, userId, "body-comp-docs", bytes);
  } catch (error) {
    if (error instanceof ImageError) throw new BodyError("invalid", error.message);
    throw error;
  }
}

export const prepareReportPdfUpload = (db: Db, userId: string) => createPdfUpload(db, userId);

/** Downloads the user's uploaded report and asks Claude for a draft. Persists nothing. */
export async function extractFromUpload(db: Db, userId: string, documentPath: string, runAi: RunAi = userAi(userId)): Promise<ExtractionResponse> {
  if (!ownsPath(userId, documentPath)) throw new BodyError("invalid", "That report file doesn't belong to you.");
  const { data: file } = await db.storage.from("body-comp-docs").download(documentPath);
  if (!file) throw new BodyError("not_found", "The uploaded report was not found. Please upload it again.");
  const doc = {
    mediaType: documentPath.endsWith(".pdf") ? ("application/pdf" as const) : ("image/jpeg" as const),
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
  };

  let result;
  try {
    result = await runAi((client) => extractBodyComposition(client, doc));
  } catch (error) {
    if (error instanceof MissingAiKeyError) {
      throw new BodyError("no_ai_key", "Reading reports automatically needs your AI key. You can enter the values by hand below.");
    }
    if (error instanceof InvalidAiKeyError) {
      throw new BodyError("ai_key_invalid", "Your AI provider no longer accepts your key. Update it in Settings, or enter the values by hand.");
    }
    if (error instanceof AiRefusalError) throw new BodyError("ai_declined", AI_DECLINED_MESSAGE);
    if (error instanceof Anthropic.APIError) {
      throw new BodyError("ai_unavailable", "The report couldn't be read right now. Try again, or enter the values by hand.");
    }
    throw error;
  }
  if (result.kind !== "draft") return result;
  const { values } = deriveComposition({
    weight_kg: result.draft.weight,
    body_fat_pct: result.draft.body_fat_pct,
    fat_mass_kg: result.draft.fat_mass,
    lean_mass_kg: result.draft.lean_mass,
  });
  return { ...result, warnings: checkConsistency(values) };
}

/** Discarding an extraction deletes its file, unless a saved test already references it. */
export async function discardUpload(db: Db, userId: string, documentPath: string): Promise<void> {
  if (!ownsPath(userId, documentPath)) throw new BodyError("invalid", "That report file doesn't belong to you.");
  const { data } = await db.from("body_composition_tests").select("id").eq("document_path", documentPath).limit(1);
  if (data?.length) return;
  await removeFile(db, "body-comp-docs", documentPath);
}
