import "server-only";
import { randomUUID } from "node:crypto";
import { ImageError, MEAL_PHOTO_LONG_EDGE, normalizeImage } from "@/server/images/normalize";
import type { Db } from "@/server/body/weights";
import { NutritionError } from "./errors";

const BUCKET = "meal-photos";
const ORPHAN_AGE_MS = 24 * 3_600_000;
const SIGNED_URL_SECONDS = 600;

export const ownsPath = (userId: string, path: string) => path.startsWith(`${userId}/`) && !path.includes("..");

/** Lazy cleanup (no cron): photos uploaded more than a day ago that no meal references. */
async function removeOrphans(db: Db, userId: string, now: Date): Promise<void> {
  const { data: objects } = await db.storage.from(BUCKET).list(userId, { limit: 1000 });
  if (!objects?.length) return;
  const { data: meals } = await db.from("meals").select("photo_path").not("photo_path", "is", null);
  const referenced = new Set((meals ?? []).map((m) => m.photo_path));
  const stale = objects
    .filter((o) => o.id !== null && o.created_at && now.getTime() - Date.parse(o.created_at) > ORPHAN_AGE_MS)
    .map((o) => `${userId}/${o.name}`)
    .filter((path) => !referenced.has(path));
  if (stale.length > 0) await db.storage.from(BUCKET).remove(stale);
}

/** Re-encodes (≤ 1568 px, EXIF stripped) and stores at meal-photos/<user_id>/<uuid>.jpg. */
export async function storeMealPhoto(db: Db, userId: string, bytes: Uint8Array, now = new Date()): Promise<string> {
  await removeOrphans(db, userId, now);
  let image;
  try {
    image = await normalizeImage(bytes, { maxLongEdge: MEAL_PHOTO_LONG_EDGE });
  } catch (error) {
    if (error instanceof ImageError) throw new NutritionError("invalid", error.message);
    throw error;
  }
  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await db.storage.from(BUCKET).upload(path, image.bytes, { contentType: "image/jpeg" });
  if (error) throw new NutritionError("invalid", "The photo could not be stored. Please try again.");
  return path;
}

export async function downloadMealPhoto(db: Db, userId: string, path: string): Promise<string> {
  if (!ownsPath(userId, path)) throw new NutritionError("invalid", "That photo doesn't belong to you.");
  const { data } = await db.storage.from(BUCKET).download(path);
  if (!data) throw new NutritionError("not_found", "The photo was not found. Please take it again.");
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

export async function signedMealPhotoUrls(db: Db, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function removeMealPhoto(db: Db, path: string): Promise<void> {
  await db.storage.from(BUCKET).remove([path]);
}
