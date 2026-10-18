import "server-only";
import sharp from "sharp";

/** Client re-encodes to ≤ ~1 MB; anything over this didn't go through the client path. */
export const MAX_NORMALIZED_BYTES = 4 * 1024 * 1024;
export const MAX_LONG_EDGE = 2048;
/** Claude's recommended maximum; meal photos are only read by the model and shown small. */
export const MEAL_PHOTO_LONG_EDGE = 1568;

export class ImageError extends Error {
  constructor(
    readonly code: "too_large" | "not_image",
    message: string,
  ) {
    super(message);
    this.name = "ImageError";
  }
}

/**
 * Re-encodes an uploaded image to an upright JPEG with no metadata. sharp drops
 * EXIF/XMP/ICC-attached metadata unless withMetadata() is called; .rotate()
 * applies and removes the EXIF orientation tag.
 */
export async function normalizeImage(
  input: Uint8Array,
  options: { maxLongEdge?: number } = {},
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const longEdge = options.maxLongEdge ?? MAX_LONG_EDGE;
  if (input.byteLength > MAX_NORMALIZED_BYTES) throw new ImageError("too_large", "Images must be 4 MB or smaller after compression.");
  try {
    const { data, info } = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { bytes: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new ImageError("not_image", "That file isn't a supported image (JPEG, PNG or HEIC).");
  }
}
