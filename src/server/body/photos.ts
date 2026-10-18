import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Tables } from "@/lib/database.types";
import { daysBetween } from "@/lib/activities/dates";
import { fieldErrorsOf } from "@/lib/body/schemas";
import { localDate, startOfLocalDay } from "@/lib/time";
import { AI_MODELS, InvalidAiKeyError, MissingAiKeyError, withUserAnthropic } from "@/server/ai/client";
import type { Profile } from "@/server/auth";
import { ImageError } from "@/server/images/normalize";
import { BodyError, requireRow } from "./errors";
import { analyzePhotoPair, type AnalysisClient, type PhotoAnalysis } from "./photo-analysis";
import { removeFile, signedUrls, storeImage } from "./uploads";
import type { Db } from "./weights";

export type PhotoRow = Tables<"progress_photos">;
export type PhotoWithUrl = PhotoRow & { url: string };
export type RunAnalysisAi = <T>(call: (client: AnalysisClient) => Promise<T>) => Promise<T>;

export const POSES = ["front", "side", "back"] as const;

const uploadSchema = z.object({
  pose: z.enum(POSES, "Choose a pose: front, side or back."),
  date: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.iso.date().optional()),
});

export async function uploadPhoto(db: Db, profile: Profile, input: { bytes: Uint8Array; pose: unknown; date?: unknown }, now = new Date()): Promise<PhotoRow> {
  const parsed = uploadSchema.safeParse({ pose: input.pose, date: input.date });
  if (!parsed.success) throw new BodyError("invalid", "Choose a pose for the photo.", fieldErrorsOf(parsed.error));
  const today = localDate(now, profile.timezone);
  const date = parsed.data.date ?? today;
  if (date > today) throw new BodyError("invalid", "The photo date can't be in the future.", { date: ["The photo date can't be in the future."] });

  let stored;
  try {
    stored = await storeImage(db, profile.user_id, "progress-photos", input.bytes);
  } catch (error) {
    if (error instanceof ImageError) throw new BodyError("invalid", error.message);
    throw error;
  }
  const { data, error } = await db
    .from("progress_photos")
    .insert({
      pose: parsed.data.pose,
      local_date: date,
      occurred_at: startOfLocalDay(date, profile.timezone).toISOString(),
      storage_path: stored.path,
      width: stored.width,
      height: stored.height,
    })
    .select()
    .single();
  if (error) {
    await removeFile(db, "progress-photos", stored.path);
    throw new BodyError("invalid", "The photo could not be saved.");
  }
  return data;
}

async function withUrls(db: Db, rows: PhotoRow[]): Promise<PhotoWithUrl[]> {
  const urls = await signedUrls(db, "progress-photos", rows.map((r) => r.storage_path));
  return rows.flatMap((r) => (urls.has(r.storage_path) ? [{ ...r, url: urls.get(r.storage_path)! }] : []));
}

/** Gallery: newest first, each with a 10-minute signed URL. */
export async function listPhotos(db: Db): Promise<PhotoWithUrl[]> {
  const { data, error } = await db.from("progress_photos").select("*").order("local_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return withUrls(db, data);
}

export async function deletePhoto(db: Db, id: string): Promise<void> {
  const { data } = await db.from("progress_photos").delete().eq("id", id).select("storage_path").maybeSingle();
  const row = requireRow(data, "Photo");
  await removeFile(db, "progress-photos", row.storage_path);
}

type CompareSide = { photo: PhotoWithUrl; weightKg: number | null } | null;

export async function comparePhotos(db: Db, input: { dateA: string; dateB: string; pose: string }) {
  const [first, second] = [input.dateA, input.dateB].sort() as [string, string];
  const { data: rows } = await db
    .from("progress_photos")
    .select("*")
    .eq("pose", input.pose as (typeof POSES)[number])
    .in("local_date", [first, second])
    .order("created_at", { ascending: false });
  const photos = await withUrls(db, rows ?? []);
  const { data: weights } = await db.from("daily_body_weight").select("local_date, weight_kg").in("local_date", [first, second]);
  const side = (date: string): CompareSide => {
    const photo = photos.find((p) => p.local_date === date);
    if (!photo) return null;
    const w = weights?.find((x) => x.local_date === date)?.weight_kg;
    return { photo, weightKg: w === undefined || w === null ? null : Number(w) };
  };
  return { a: side(first), b: side(second), daysApart: daysBetween(first, second) };
}

export async function setPhotoAiConsent(db: Db, userId: string, consent: boolean): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ progress_photo_ai_consent_at: consent ? new Date().toISOString() : null })
    .eq("user_id", userId);
  if (error) throw new BodyError("invalid", "Your choice could not be saved.");
}

const userAnalysisAi = (userId: string): RunAnalysisAi => (call) => withUserAnthropic(userId, call);

/**
 * Consent is enforced here, server-side: without it no photo leaves storage.
 * Only qualitative observations are stored; the visual impression is returned once.
 */
export async function analyzePhotos(
  db: Db,
  profile: Profile,
  photoAId: string,
  photoBId: string,
  runAi: RunAnalysisAi = userAnalysisAi(profile.user_id),
): Promise<PhotoAnalysis & { id: string }> {
  if (!profile.progress_photo_ai_consent_at) {
    throw new BodyError("consent_required", "Turn on AI photo analysis in Settings first. Photos are only sent to Anthropic after you opt in.");
  }
  const { data: photos } = await db.from("progress_photos").select("*").in("id", [photoAId, photoBId]);
  if (photoAId === photoBId || photos?.length !== 2) throw new BodyError("not_found", "Photo not found");
  const [before, after] = [...photos].sort((x, y) => x.local_date.localeCompare(y.local_date)) as [PhotoRow, PhotoRow];
  if (before.pose !== after.pose) throw new BodyError("invalid", "Compare two photos with the same pose.");

  const load = async (p: PhotoRow) => {
    const { data } = await db.storage.from("progress-photos").download(p.storage_path);
    if (!data) throw new BodyError("not_found", "Photo file not found");
    return { base64: Buffer.from(await data.arrayBuffer()).toString("base64"), date: p.local_date };
  };
  const [imgA, imgB] = await Promise.all([load(before), load(after)]);

  let analysis: PhotoAnalysis | null;
  try {
    analysis = await runAi((client) => analyzePhotoPair(client, imgA, imgB, before.pose));
  } catch (error) {
    if (error instanceof MissingAiKeyError) throw new BodyError("no_ai_key", "Photo analysis needs your Anthropic API key.");
    if (error instanceof InvalidAiKeyError) throw new BodyError("ai_key_invalid", "Anthropic no longer accepts your API key. Update it in Settings.");
    if (error instanceof Anthropic.APIError) throw new BodyError("ai_unavailable", "The analysis couldn't run right now. Please try again.");
    throw error;
  }
  if (!analysis) throw new BodyError("ai_unavailable", "No usable comparison came back. Please try again.");

  const today = localDate(new Date(), profile.timezone);
  const { data, error } = await db
    .from("progress_photo_analyses")
    .insert({
      photo_a_id: before.id,
      photo_b_id: after.id,
      observations: analysis.observations,
      model: AI_MODELS.main,
      local_date: today,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new BodyError("invalid", "The analysis could not be saved.");
  return { id: data.id, ...analysis };
}

export async function listAnalyses(db: Db) {
  const { data } = await db.from("progress_photo_analyses").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
