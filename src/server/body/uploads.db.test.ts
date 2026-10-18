import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { removeOrphanUploads } from "./uploads";

let u: TestUser;
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const day = { occurred_at: "2026-10-01T05:00:00Z", local_date: "2026-10-01" };
const HOUR = 3_600_000;

async function files(bucket: string) {
  return ((await u.client.storage.from(bucket).list(u.id)).data ?? []).map((f) => f.name).sort();
}

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  for (const name of ["orphan.jpg", "referenced.jpg"]) {
    await u.client.storage.from("progress-photos").upload(`${u.id}/${name}`, jpeg());
    await u.client.storage.from("body-comp-docs").upload(`${u.id}/${name}`, jpeg());
  }
  await u.client.from("progress_photos").insert({ ...day, pose: "front", storage_path: `${u.id}/referenced.jpg`, width: 1, height: 1 });
  await u.client.from("body_composition_tests").insert({ ...day, method: "inbody", document_path: `${u.id}/referenced.jpg` });
});

afterAll(() => deleteTestUser(u));

describe("removeOrphanUploads", () => {
  it.each(["progress-photos", "body-comp-docs"] as const)("Given recent unreferenced files in %s, Then they are kept", async (bucket) => {
    expect(await removeOrphanUploads(u.client, u.id, bucket, new Date())).toEqual([]);
    expect(await files(bucket)).toEqual(["orphan.jpg", "referenced.jpg"]);
  });

  it.each(["progress-photos", "body-comp-docs"] as const)(
    "Given an unreferenced file older than 24 h in %s, Then it is removed and referenced files are kept",
    async (bucket) => {
      const later = new Date(Date.now() + 25 * HOUR);
      expect(await removeOrphanUploads(u.client, u.id, bucket, later)).toEqual([`${u.id}/orphan.jpg`]);
      expect(await files(bucket)).toEqual(["referenced.jpg"]);
    },
  );
});
