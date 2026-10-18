import { describe, expect, it } from "vitest";
import { ClientImageError, checkOriginal, scaledSize } from "./normalize-client";

const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

describe("checkOriginal", () => {
  it.each([
    ["a.jpg", "image/jpeg"],
    ["a.png", "image/png"],
    ["IMG_0001.HEIC", "image/heic"],
    ["IMG_0002.heic", ""],
  ])("accepts %s (%s)", (name, type) => {
    expect(() => checkOriginal(file(name, type, 10), 15 * 1024 * 1024)).not.toThrow();
  });

  it("rejects a .docx file", () => {
    expect(() => checkOriginal(file("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10), 10 * 1024 * 1024)).toThrow(
      ClientImageError,
    );
  });

  it("rejects originals over the limit with the allowed size", () => {
    expect(() => checkOriginal(file("big.jpg", "image/jpeg", 16 * 1024 * 1024), 15 * 1024 * 1024)).toThrow(/15 MB/);
  });
});

describe("scaledSize", () => {
  it("Given a 4032×3024 photo and a 1568 px limit, Then it scales to 1568×1176", () => {
    expect(scaledSize(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 });
  });

  it("never enlarges a small photo", () => {
    expect(scaledSize(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  it("handles portrait photos", () => {
    expect(scaledSize(3024, 4032, 1568)).toEqual({ width: 1176, height: 1568 });
  });
});
