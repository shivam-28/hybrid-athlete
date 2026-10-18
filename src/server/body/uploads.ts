import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeImage } from "@/server/images/normalize";
import { BodyError } from "./errors";
import type { Db } from "./weights";

export type BodyBucket = "body-comp-docs" | "progress-photos";
const ORPHAN_AGE_MS = 24 * 3_600_000;
const SIGNED_URL_SECONDS = 600;

async function referencedPaths(db: Db, bucket: BodyBucket): Promise<Set<string>> {
  if (bucket === "progress-photos") {
    const { data } = await db.from("progress_photos").select("storage_path");
    return new Set((data ?? []).map((r) => r.storage_path));
  }
  const { data } = await db.from("body_composition_tests").select("document_path").not("document_path", "is", null);
  return new Set((data ?? []).map((r) => r.document_path!));
}

/**
 * Lazy cleanup (no cron): deletes the user's files that no row references and
 * that are older than 24 h, i.e. uploads abandoned before confirm/save.
 */
export async function removeOrphanUploads(db: Db, userId: string, bucket: BodyBucket, now = new Date()): Promise<string[]> {
  const { data: objects } = await db.storage.from(bucket).list(userId, { limit: 1000 });
  if (!objects?.length) return [];
  const referenced = await referencedPaths(db, bucket);
  const stale = objects
    .filter((o) => o.id !== null && o.created_at !== null && now.getTime() - Date.parse(o.created_at) > ORPHAN_AGE_MS)
    .map((o) => `${userId}/${o.name}`)
    .filter((path) => !referenced.has(path));
  if (stale.length > 0) await db.storage.from(bucket).remove(stale);
  return stale;
}

/** Normalises an image (EXIF stripped) and stores it at <user_id>/<uuid>.jpg. */
export async function storeImage(db: Db, userId: string, bucket: BodyBucket, bytes: Uint8Array) {
  await removeOrphanUploads(db, userId, bucket);
  const image = await normalizeImage(bytes);
  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await db.storage.from(bucket).upload(path, image.bytes, { contentType: "image/jpeg" });
  if (error) throw new BodyError("invalid", "The image could not be stored. Please try again.");
  return { path, width: image.width, height: image.height };
}

/** PDFs go straight from the browser to storage (they can exceed Vercel's body limit). */
export async function createPdfUpload(db: Db, userId: string) {
  await removeOrphanUploads(db, userId, "body-comp-docs");
  const path = `${userId}/${randomUUID()}.pdf`;
  const { data, error } = await db.storage.from("body-comp-docs").createSignedUploadUrl(path);
  if (error) throw new BodyError("invalid", "The upload could not be prepared. Please try again.");
  return { path, token: data.token };
}

export async function removeFile(db: Db, bucket: BodyBucket, path: string): Promise<void> {
  await db.storage.from(bucket).remove([path]);
}

export async function signedUrls(db: Db, bucket: BodyBucket, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await db.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

/** True when the path is inside the caller's own folder (defence in depth on top of storage RLS). */
export const ownsPath = (userId: string, path: string) => path.startsWith(`${userId}/`) && !path.includes("..");
