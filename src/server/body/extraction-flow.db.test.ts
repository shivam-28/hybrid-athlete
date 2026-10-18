import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MissingAiKeyError } from "@/server/ai/client";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { ExtractionClient } from "./extract";
import { discardUpload, extractFromUpload, uploadReportImage, type RunAi } from "./extraction-flow";

let u: TestUser;
let other: TestUser;
let imagePath: string;

const fakeAi = (parsed_output: unknown): RunAi =>
  (async (call: (c: ExtractionClient) => Promise<unknown>) =>
    call({ beta: { messages: { parse: vi.fn(async () => ({ stop_reason: "end_turn", parsed_output })) } } } as unknown as ExtractionClient)) as RunAi;
const noKey: RunAi = (async () => {
  throw new MissingAiKeyError();
}) as RunAi;

const RAW = {
  is_body_composition_report: true,
  test_date: "2026-10-01",
  method: "inbody",
  mass_unit: "lb",
  weight: 176.4,
  body_fat_pct: 81.5,
  fat_mass: null,
  lean_mass: null,
  skeletal_muscle: null,
  visceral_fat_level: null,
  bmr_kcal: null,
  total_body_water: null,
  segmental_lean: null,
};

async function testCount() {
  return (await u.client.from("body_composition_tests").select("id")).data!.length;
}

beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
  for (const x of [u, other]) await x.client.from("profiles").insert(sampleProfile);
  const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).jpeg().toBuffer();
  imagePath = (await uploadReportImage(u.client, u.id, new Uint8Array(jpeg))).path;
});

afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

describe("report upload", () => {
  it("stores the normalised image in the user's folder", async () => {
    expect(imagePath).toMatch(new RegExp(`^${u.id}/[0-9a-f-]{36}\\.jpg$`));
    expect((await u.client.storage.from("body-comp-docs").download(imagePath)).data).not.toBeNull();
  });

  it("rejects non-images", async () => {
    await expect(uploadReportImage(u.client, u.id, new TextEncoder().encode("not an image"))).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("extractFromUpload", () => {
  it("Given a valid extraction in lb, Then a kg draft with 'not found' fields and warnings is returned and nothing is saved", async () => {
    const result = await extractFromUpload(u.client, u.id, imagePath, fakeAi(RAW));
    expect(result.kind).toBe("draft");
    if (result.kind !== "draft") return;
    expect(result.draft).toMatchObject({ weight: 80.01, body_fat_pct: 81.5, method: "inbody", test_date: "2026-10-01" });
    expect(result.notFound).toContain("fat_mass");
    expect(result.warnings.map((w) => w.code)).toContain("body_fat_range");
    expect(await testCount()).toBe(0);
  });

  it("Given output that fails validation, Then 'unreadable' and nothing is saved", async () => {
    expect((await extractFromUpload(u.client, u.id, imagePath, fakeAi(null))).kind).toBe("unreadable");
    expect(await testCount()).toBe(0);
  });

  it("Given no values, Then 'empty'", async () => {
    expect((await extractFromUpload(u.client, u.id, imagePath, fakeAi({ ...RAW, is_body_composition_report: false }))).kind).toBe("empty");
  });

  it("Given no AI key, Then a no_ai_key error and the file stays for manual entry", async () => {
    await expect(extractFromUpload(u.client, u.id, imagePath, noKey)).rejects.toMatchObject({ code: "no_ai_key" });
    expect((await u.client.storage.from("body-comp-docs").download(imagePath)).data).not.toBeNull();
    expect(await testCount()).toBe(0);
  });

  it("Given another user's file, Then it is refused without calling the AI", async () => {
    const ai = vi.fn() as unknown as RunAi;
    await expect(extractFromUpload(other.client, other.id, imagePath, ai)).rejects.toMatchObject({ code: "invalid" });
    expect(ai).not.toHaveBeenCalled();
  });
});

describe("discardUpload", () => {
  it("Given a discarded extraction, Then the uploaded file is deleted", async () => {
    await discardUpload(u.client, u.id, imagePath);
    expect((await u.client.storage.from("body-comp-docs").download(imagePath)).data).toBeNull();
  });
});
