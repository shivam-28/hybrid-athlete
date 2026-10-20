import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/server/auth";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { AnalysisClient } from "./photo-analysis";
import { analyzePhotos, comparePhotos, deletePhoto, listPhotos, setPhotoAiConsent, uploadPhoto, type RunAnalysisAi } from "./photos";
import { refusingAi } from "../../../tests/ai-test-helpers";

let u: TestUser;
let other: TestUser;
let profile: Profile;
let otherProfile: Profile;

async function gpsJpeg() {
  return new Uint8Array(
    await sharp({ create: { width: 30, height: 60, channels: 3, background: "#a33" } })
      .jpeg()
      .withExif({ IFD0: { Make: "Apple" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "55/1 40/1 0/1" } })
      .toBuffer(),
  );
}

const ai = (parsed_output: unknown) => {
  const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output }));
  const run = (async (call: (c: AnalysisClient) => Promise<unknown>) => call({ beta: { messages: { parse } } } as unknown as AnalysisClient)) as RunAnalysisAi;
  return { run, parse };
};

beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
  for (const x of [u, other]) await x.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
  otherProfile = (await other.client.from("profiles").select("*").single()).data!;
});

afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

describe("uploadPhoto", () => {
  it("Given a front photo with no date, Then it is stored under today in the user's timezone without EXIF", async () => {
    const row = await uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "front" }, new Date("2026-10-01T22:30:00Z"));
    expect(row).toMatchObject({ pose: "front", local_date: "2026-10-02", width: 30, height: 60 });
    const stored = await u.client.storage.from("progress-photos").download(row.storage_path);
    expect((await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata()).exif).toBeUndefined();
  });

  it("Given no pose, Then it is rejected asking for a pose", async () => {
    await expect(uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "" })).rejects.toMatchObject({
      code: "invalid",
      fieldErrors: { pose: [expect.stringMatching(/pose/i)] },
    });
  });

  it("Given a future date, Then it is rejected", async () => {
    await expect(uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "back", date: "2099-01-01" })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("gallery and comparison", () => {
  it("lists photos newest first with short-lived signed URLs", async () => {
    await uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "front", date: "2026-08-01" });
    const photos = await listPhotos(u.client);
    expect(photos[0]!.local_date).toBe("2026-10-02");
    expect(photos.every((p) => p.url.includes("token="))).toBe(true);
  });

  it("Given front photos on 2026-08-01 and 2026-10-01, Then they compare as 61 days apart with each day's weight", async () => {
    await uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "front", date: "2026-10-01" });
    await u.client.from("body_weights").insert({ local_date: "2026-08-01", occurred_at: "2026-08-01T05:00:00Z", weight_kg: 81.2 });
    const cmp = await comparePhotos(u.client, { dateA: "2026-08-01", dateB: "2026-10-01", pose: "front" });
    expect(cmp.daysApart).toBe(61);
    expect(cmp.a?.weightKg).toBe(81.2);
    expect(cmp.b?.weightKg).toBeNull();
    expect(cmp.a?.photo.url).toContain("token=");
  });

  it("Given an expired link, Then the image is not served", async () => {
    const [photo] = await listPhotos(u.client);
    const { data } = await u.client.storage.from("progress-photos").createSignedUrl(photo!.storage_path, 1);
    await new Promise((r) => setTimeout(r, 2100));
    expect((await fetch(data!.signedUrl)).ok).toBe(false);
  });

  it("Given another user, Then they cannot list or download the photos", async () => {
    expect(await listPhotos(other.client)).toEqual([]);
    const [photo] = await listPhotos(u.client);
    expect((await other.client.storage.from("progress-photos").download(photo!.storage_path)).data).toBeNull();
  });
});

describe("AI analysis consent and analysis", () => {
  const pair = async () => {
    const photos = await listPhotos(u.client);
    const fronts = photos.filter((p) => p.pose === "front");
    return [fronts.at(-1)!.id, fronts[0]!.id] as const;
  };

  it("Given no consent, Then analysis is refused and nothing is sent to the AI", async () => {
    const { run, parse } = ai({ observations: ["x"], visual_impression: null });
    const [a, b] = await pair();
    await expect(analyzePhotos(u.client, profile, a, b, run)).rejects.toMatchObject({ code: "consent_required" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("Given consent, Then observations are saved with the pair and the visual impression is returned but not stored", async () => {
    await setPhotoAiConsent(u.client, u.id, true);
    profile = (await u.client.from("profiles").select("*").single()).data!;
    expect(profile.progress_photo_ai_consent_at).not.toBeNull();
    const { run } = ai({ observations: ["Waist looks narrower."], visual_impression: "Roughly 15–17 %" });
    const [a, b] = await pair();
    const result = await analyzePhotos(u.client, profile, a, b, run);
    expect(result.observations).toEqual(["Waist looks narrower."]);
    expect(result.visualImpression).toBe("Roughly 15–17 %");
    const { data } = await u.client.from("progress_photo_analyses").select("*");
    expect(data).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("15–17");
  });

  it("Given Claude declines the comparison, Then ai_declined is raised and nothing is stored", async () => {
    const before = (await u.client.from("progress_photo_analyses").select("id")).data?.length ?? 0;
    const [a, b] = await pair();
    await expect(analyzePhotos(u.client, profile, a, b, refusingAi().run)).rejects.toMatchObject({ code: "ai_declined" });
    expect((await u.client.from("progress_photo_analyses").select("id")).data).toHaveLength(before);
  });

  it("Given photos with different poses, Then analysis is rejected", async () => {
    const side = await uploadPhoto(u.client, profile, { bytes: await gpsJpeg(), pose: "side", date: "2026-09-01" });
    const [a] = await pair();
    await expect(analyzePhotos(u.client, profile, a, side.id, ai({ observations: ["x"], visual_impression: null }).run)).rejects.toMatchObject({ code: "invalid" });
  });

  it("Given another user's photo, Then analysis is rejected", async () => {
    await setPhotoAiConsent(other.client, other.id, true);
    otherProfile = (await other.client.from("profiles").select("*").single()).data!;
    const [a, b] = await pair();
    await expect(analyzePhotos(other.client, otherProfile, a, b, ai({ observations: ["x"], visual_impression: null }).run)).rejects.toMatchObject({ code: "not_found" });
  });

  it("Given consent is withdrawn, Then analysis is blocked again", async () => {
    await setPhotoAiConsent(u.client, u.id, false);
    profile = (await u.client.from("profiles").select("*").single()).data!;
    expect(profile.progress_photo_ai_consent_at).toBeNull();
    const [a, b] = await pair();
    await expect(analyzePhotos(u.client, profile, a, b, ai({ observations: ["x"], visual_impression: null }).run)).rejects.toMatchObject({ code: "consent_required" });
  });
});

describe("deletePhoto", () => {
  it("removes the file and the analyses referencing it", async () => {
    const photos = await listPhotos(u.client);
    const target = photos.find((p) => p.pose === "front" && p.local_date === "2026-08-01")!;
    await deletePhoto(u.client, target.id);
    expect((await u.client.storage.from("progress-photos").download(target.storage_path)).data).toBeNull();
    expect((await u.client.from("progress_photo_analyses").select("id")).data).toEqual([]);
    expect((await listPhotos(u.client)).some((p) => p.id === target.id)).toBe(false);
  });
});
