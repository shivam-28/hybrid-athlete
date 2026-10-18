import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteAccount } from "../account/delete";
import { buildExport } from "../account/export";

let a: TestUser;
let b: TestUser;
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const day = { occurred_at: "2026-10-01T05:00:00Z", local_date: "2026-10-01" };

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) {
    await u.client.from("profiles").insert(sampleProfile);
    await u.client.from("body_weights").insert({ ...day, weight_kg: 80 });
    await u.client.storage.from("progress-photos").upload(`${u.id}/photo.jpg`, jpeg());
    await u.client.storage.from("body-comp-docs").upload(`${u.id}/report.jpg`, jpeg());
  }
  await a.client.from("progress_photos").insert({ ...day, pose: "front", storage_path: `${a.id}/photo.jpg`, width: 1, height: 1 });
  await a.client
    .from("body_composition_tests")
    .insert({ ...day, method: "inbody", body_fat_pct: 20, document_path: `${a.id}/report.jpg`, source: "extracted" });
  await a.client.from("body_measurements").insert({ ...day, waist_cm: 86 });
  await a.client.from("body_goals").insert({ ...day, goal_weight_kg: 76 });
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("body data in account export/delete", () => {
  it("Given A has body data, photos and a report, When A exports, Then all of it is included", async () => {
    const result = await buildExport(a.client, a.id);
    for (const table of ["body_weights", "body_measurements", "body_composition_tests", "progress_photos", "body_goals"]) {
      expect(result.tables[table]).toHaveLength(1);
    }
    expect(result.files.map((f) => f.bucket).sort()).toEqual(["body-comp-docs", "progress-photos"]);
  });

  it("When A deletes the account, Then A's body rows and files are removed and B's remain", async () => {
    await deleteAccount(a.id);
    const admin = adminClient();
    expect((await admin.storage.from("progress-photos").list(a.id)).data).toEqual([]);
    expect((await admin.storage.from("body-comp-docs").list(a.id)).data).toEqual([]);
    expect((await admin.from("body_weights").select("id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.from("progress_photos").select("id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.storage.from("progress-photos").list(b.id)).data).toHaveLength(1);
    expect((await admin.from("body_weights").select("id").eq("user_id", b.id)).data).toHaveLength(1);
  });
});
