import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteTest, listTests, saveTest, updateTest } from "./composition";
import { getLatestBodyComposition } from "./read";

let u: TestUser;
let other: TestUser;
let profile: Profile;
const manual = { unit: "kg", method: "dexa", test_date: "2026-10-01" };

beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
  for (const x of [u, other]) await x.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
});

afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

describe("manual body composition entry", () => {
  it("Given a DEXA test with weight 79.0 and body fat 18.5 % and no AI key, Then it is saved with derived masses flagged", async () => {
    const row = await saveTest(u.client, profile, { ...manual, weight: "79.0", body_fat_pct: "18.5" });
    expect(row).toMatchObject({ method: "dexa", local_date: "2026-10-01", source: "manual" });
    expect(Number(row.body_fat_pct)).toBe(18.5);
    expect(Number(row.fat_mass_kg)).toBe(14.62);
    expect(Number(row.lean_mass_kg)).toBe(64.38);
    expect(row.derived_fields.sort()).toEqual(["fat_mass_kg", "lean_mass_kg"]);
    expect(row.occurred_at).toBe("2026-09-30T22:00:00+00:00");
  });

  it("Given no method, Then it is rejected with a validation message", async () => {
    await expect(saveTest(u.client, profile, { unit: "kg", test_date: "2026-10-01", body_fat_pct: 20 })).rejects.toMatchObject({
      code: "invalid",
      fieldErrors: { method: [expect.stringContaining("Choose")] },
    });
  });

  it("accepts any subset of fields, including segmental lean mass in lb", async () => {
    const row = await saveTest(u.client, profile, {
      method: "inbody",
      test_date: "2026-09-01",
      unit: "lb",
      skeletal_muscle: 80,
      segmental_lean: { trunk: 60, left_arm: "" },
    });
    expect(Number(row.skeletal_muscle_kg)).toBe(36.29);
    expect(row.segmental_lean).toEqual({ trunk: 27.22 });
    expect(row.body_fat_pct).toBeNull();
  });
});

describe("edit and delete", () => {
  it("Given a saved test, When edited, Then values and derived fields are recomputed", async () => {
    const row = await saveTest(u.client, profile, { ...manual, test_date: "2026-08-15", weight: 80, body_fat_pct: 20 });
    const updated = await updateTest(u.client, profile, row.id, { ...manual, test_date: "2026-08-15", weight: 80, body_fat_pct: 21 });
    expect(Number(updated.fat_mass_kg)).toBe(16.8);
  });

  it("Given a test with an uploaded report, When deleted, Then the row and the file are removed", async () => {
    const path = `${u.id}/report.jpg`;
    await u.client.storage.from("body-comp-docs").upload(path, new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }));
    const row = await saveTest(u.client, profile, { ...manual, body_fat_pct: 20 }, { documentPath: path, source: "extracted" });
    expect(row.document_path).toBe(path);
    await deleteTest(u.client, row.id);
    expect((await u.client.from("body_composition_tests").select("id").eq("id", row.id)).data).toEqual([]);
    expect((await u.client.storage.from("body-comp-docs").download(path)).data).toBeNull();
  });

  it("Given another user's test, When they edit or delete it, Then not found", async () => {
    const row = await saveTest(u.client, profile, { ...manual, body_fat_pct: 20 });
    await expect(deleteTest(other.client, row.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(updateTest(other.client, profile, row.id, { ...manual, body_fat_pct: 30 })).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a document path outside the user's folder", async () => {
    await expect(saveTest(u.client, profile, { ...manual }, { documentPath: `${other.id}/x.jpg`, source: "extracted" })).rejects.toMatchObject({
      code: "invalid",
    });
  });
});

describe("getLatestBodyComposition", () => {
  it("Given no test with body fat %, Then none is available", async () => {
    expect(await getLatestBodyComposition(other.client)).toBeNull();
  });

  it("Given tests on 2026-08-01 (19 %) and 2026-10-01 (18 %), Then the 2026-10-01 test is used", async () => {
    await saveTest(other.client, profile, { ...manual, test_date: "2026-08-01", weight: 80, body_fat_pct: 19 });
    await saveTest(other.client, profile, { ...manual, test_date: "2026-10-01", weight: 80, body_fat_pct: 18 });
    await saveTest(other.client, profile, { ...manual, method: "inbody", test_date: "2026-10-05", skeletal_muscle: 35 });
    expect(await getLatestBodyComposition(other.client)).toEqual({
      testedOn: "2026-10-01",
      method: "dexa",
      bodyFatPct: 18,
      leanMassKg: 65.6,
    });
  });

  it("ignores progress photo analyses entirely", async () => {
    const before = await getLatestBodyComposition(other.client);
    const photo = (path: string) => ({ occurred_at: "2026-10-10T00:00:00Z", local_date: "2026-10-10", pose: "front" as const, storage_path: path, width: 1, height: 1 });
    const a = (await other.client.from("progress_photos").insert(photo(`${other.id}/a.jpg`)).select("id").single()).data!;
    const b = (await other.client.from("progress_photos").insert(photo(`${other.id}/b.jpg`)).select("id").single()).data!;
    await other.client.from("progress_photo_analyses").insert({
      occurred_at: "2026-10-10T00:00:00Z",
      local_date: "2026-10-10",
      photo_a_id: a.id,
      photo_b_id: b.id,
      observations: ["Leaner midsection, roughly 12 % body fat"],
      model: "test",
    });
    expect(await getLatestBodyComposition(other.client)).toEqual(before);
  });

  it("lists tests newest first", async () => {
    const tests = await listTests(other.client);
    expect(tests.map((t) => t.local_date)).toEqual(["2026-10-05", "2026-10-01", "2026-08-01"]);
  });
});
