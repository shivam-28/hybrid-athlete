import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteAccount } from "../account/delete";
import { buildExport } from "../account/export";

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) {
    await u.client.from("profiles").insert(sampleProfile);
    const act = await u.client
      .from("activities")
      .insert({ occurred_at: "2026-06-14T06:00:00Z", local_date: "2026-06-14", sport: "running", sources: ["fit"] })
      .select("id")
      .single();
    await u.client.storage.from("activity-files").upload(`${u.id}/${act.data!.id}.fit`, new Blob([new Uint8Array([1])]));
  }
  await adminClient().from("ingest_tokens").insert({ user_id: a.id, token_hash: "f".repeat(64), prefix: "ha_zzzzz", last4: "abcd" });
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("activity data in account export/delete", () => {
  it("Given A has an activity, a FIT file and an ingest token, When A exports, Then activities and the file are included but no token hash", async () => {
    const result = await buildExport(a.client, a.id);
    expect(result.tables.activities).toHaveLength(1);
    expect(result.tables).not.toHaveProperty("ingest_tokens");
    expect(JSON.stringify(result)).not.toContain("f".repeat(64));
    expect(result.files.filter((f) => f.bucket === "activity-files")).toHaveLength(1);
  });

  it("When A deletes the account, Then A's FIT files and rows are removed and B's remain", async () => {
    await deleteAccount(a.id);
    const admin = adminClient();
    expect((await admin.storage.from("activity-files").list(a.id)).data).toEqual([]);
    expect((await admin.from("activities").select("id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.from("ingest_tokens").select("id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.storage.from("activity-files").list(b.id)).data).toHaveLength(1);
  });
});
