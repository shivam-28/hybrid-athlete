/** Browser-side: re-encode a photo to JPEG (long edge ≤ 2048 px by default) before upload. */

export const MAX_LONG_EDGE = 2048;

export function scaledSize(width: number, height: number, maxLongEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const IMAGE_EXT = /\.(jpe?g|png|heic|heif)$/i;

export class ClientImageError extends Error {}

export function checkOriginal(file: File, maxBytes: number): void {
  if (!IMAGE_TYPES.includes(file.type) && !IMAGE_EXT.test(file.name)) {
    throw new ClientImageError("Choose a JPEG, PNG or HEIC image.");
  }
  if (file.size > maxBytes) throw new ClientImageError(`Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ClientImageError("This image couldn't be read. Try a JPEG or a smaller photo."));
    };
    img.src = url;
  });
}

/**
 * Drawing to a canvas decodes HEIC (Safari), applies EXIF orientation, and drops
 * every metadata segment (GPS, device) before the bytes leave the phone.
 */
export async function reencodeForUpload(file: File, maxOriginalBytes: number, maxLongEdge = MAX_LONG_EDGE): Promise<File> {
  checkOriginal(file, maxOriginalBytes);
  const img = await loadImage(file);
  const size = scaledSize(img.naturalWidth, img.naturalHeight, maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new ClientImageError("This image couldn't be processed. Try a smaller photo.");
  return new File([blob], file.name.replace(IMAGE_EXT, "") + ".jpg", { type: "image/jpeg" });
}
