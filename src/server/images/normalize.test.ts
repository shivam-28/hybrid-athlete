import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageError, MAX_NORMALIZED_BYTES, MEAL_PHOTO_LONG_EDGE, normalizeImage } from "./normalize";

async function jpegWithGps(width = 40, height = 20, orientation?: number) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "Apple", Model: "iPhone 17 Pro" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "55/1 40/1 0/1" } });
  if (orientation) img = img.withMetadata({ orientation });
  return new Uint8Array(await img.toBuffer());
}

describe("normalizeImage", () => {
  it("Given a fixture with GPS and device EXIF, Then the output has no EXIF at all", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await normalizeImage(input);
    const meta = await sharp(out.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
    expect(Buffer.from(out.bytes).includes(Buffer.from("Exif\0\0"))).toBe(false);
    expect(Buffer.from(out.bytes).includes(Buffer.from("iPhone"))).toBe(false);
  });

  it("Given a portrait photo stored landscape with an orientation tag, Then the output is upright without the tag", async () => {
    const out = await normalizeImage(await jpegWithGps(40, 20, 6));
    const meta = await sharp(out.bytes).metadata();
    expect(meta.orientation).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([20, 40]);
    expect([out.width, out.height]).toEqual([20, 40]);
  });

  it("caps the long edge at 2048 px", async () => {
    const big = new Uint8Array(await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#888" } }).jpeg().toBuffer());
    const out = await normalizeImage(big);
    expect([out.width, out.height]).toEqual([2048, 683]);
  });

  it("Given more than 4 MB, Then it is rejected", async () => {
    await expect(normalizeImage(new Uint8Array(MAX_NORMALIZED_BYTES + 1))).rejects.toMatchObject({ code: "too_large" });
  });

  it("Given something that is not an image, Then it is rejected", async () => {
    await expect(normalizeImage(new TextEncoder().encode("PK\u0003\u0004 not an image"))).rejects.toBeInstanceOf(ImageError);
    await expect(normalizeImage(new TextEncoder().encode("hello"))).rejects.toMatchObject({ code: "not_image" });
  });
});

describe("normalizeImage for meal photos (long edge ≤ 1568 px)", () => {
  it("Given a 4032×3024 iPhone photo with GPS EXIF, Then the stored image is ≤ 1568 px and has no EXIF", async () => {
    const photo = new Uint8Array(
      await sharp({ create: { width: 4032, height: 3024, channels: 3, background: "#6a4" } })
        .jpeg({ quality: 40 })
        .withExif({ IFD0: { Make: "Apple" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "55/1 40/1 0/1" } })
        .toBuffer(),
    );
    const out = await normalizeImage(photo, { maxLongEdge: MEAL_PHOTO_LONG_EDGE });
    expect([out.width, out.height]).toEqual([1568, 1176]);
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
    expect(Buffer.from(out.bytes).includes(Buffer.from("Exif\0\0"))).toBe(false);
  });
});
