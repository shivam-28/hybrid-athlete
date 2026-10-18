import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sampleProfile,
  type TestUser,
} from "../../../tests/supabase-test-helpers";
import { saveAiKey } from "../ai/keys";
import { deleteAccount } from "./delete";
import { buildExport } from "./export";

const BUCKET = "account-test";
let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  const admin = adminClient();
  await admin.storage.createBucket(BUCKET, { public: false });
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) {
    await u.client.from("profiles").insert({ ...sampleProfile, display_name: u === a ? "A" : "B" });
    await admin.storage.from(BUCKET).upload(`${u.id}/photos/one.txt`, new Blob(["x"]));
    await admin.storage.from(BUCKET).upload(`${u.id}/two.txt`, new Blob(["y"]));
  }
  await saveAiKey(a.id, "sk-ant-api03-export-test-KEYA", async () => "valid");
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
  const admin = adminClient();
  await admin.storage.emptyBucket(BUCKET);
  await admin.storage.deleteBucket(BUCKET);
});

describe("buildExport", () => {
  it("Given two users, When A exports, Then only A's rows and files are included", async () => {
    const result = await buildExport(a.client, a.id, [BUCKET]);
    expect(result.schema_version).toBe(1);
    expect(Date.parse(result.exported_at)).not.toBeNaN();
    expect(result.tables.profiles).toHaveLength(1);
    expect(result.tables.profiles![0]).toMatchObject({ display_name: "A" });
    expect(result.files.map((f) => f.path).sort()).toEqual([`${a.id}/photos/one.txt`, `${a.id}/two.txt`]);
    expect(result.files.every((f) => f.url.startsWith("http"))).toBe(true);
  });

  it("never includes AI key material", async () => {
    const result = await buildExport(a.client, a.id, [BUCKET]);
    const json = JSON.stringify(result);
    expect(result.tables).not.toHaveProperty("user_ai_keys");
    expect(json).not.toContain("KEYA");
    expect(json).not.toContain("ciphertext");
  });
});

describe("deleteAccount", () => {
  it("Given A deletes their account, Then A's rows and files are gone and B is untouched", async () => {
    await deleteAccount(a.id, [BUCKET]);
    const admin = adminClient();

    expect((await admin.from("profiles").select("user_id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.from("user_ai_keys").select("user_id").eq("user_id", a.id)).data).toEqual([]);
    expect((await admin.storage.from(BUCKET).list(a.id)).data).toEqual([]);
    expect((await admin.auth.admin.getUserById(a.id)).data.user).toBeNull();

    expect((await admin.from("profiles").select("user_id").eq("user_id", b.id)).data).toHaveLength(1);
    expect((await admin.storage.from(BUCKET).list(b.id)).data?.length).toBeGreaterThan(0);
  });

  it("is safe to run twice", async () => {
    await expect(deleteAccount(a.id, [BUCKET])).resolves.toBeUndefined();
  });
});

describe("workout data in export and deletion", () => {
  it("Given a user with custom exercises, sessions and sets, Then export holds only their custom exercises and deletion removes them while seeded exercises remain", async () => {
    const admin = adminClient();
    const seeded = await admin
      .from("exercises")
      .insert({ source_id: "acct-test-seeded", name: "Acct Seeded", search_name: "acct seeded", tracking_mode: "weight_reps" })
      .select("id")
      .single();
    const c = await createTestUser();
    try {
      await c.client.from("profiles").insert(sampleProfile);
      const custom = await c.client
        .from("exercises")
        .insert({ name: "Acct Custom", search_name: "acct custom", tracking_mode: "weight_reps" })
        .select("id")
        .single();
      await c.client.from("exercise_muscles").insert({ exercise_id: custom.data!.id, muscle_group: "core", role: "primary" });
      const session = await c.client.from("workout_sessions").insert({ local_date: "2026-10-18" }).select("id").single();
      await c.client.from("workout_sets").insert({ session_id: session.data!.id, exercise_id: custom.data!.id, weight_kg: 10, reps: 10 });
      await c.client.from("workout_sets").insert({ session_id: session.data!.id, exercise_id: seeded.data!.id, weight_kg: 10, reps: 10 });

      const exported = await buildExport(c.client, c.id, []);
      expect(exported.tables.exercises).toHaveLength(1);
      expect(exported.tables.exercises![0]).toMatchObject({ name: "Acct Custom", exercise_muscles: [{ muscle_group: "core" }] });
      expect(exported.tables.workout_sets).toHaveLength(2);

      await deleteAccount(c.id, []);
      expect((await admin.from("exercises").select("id").eq("id", custom.data!.id)).data).toEqual([]);
      expect((await admin.from("workout_sets").select("id").eq("session_id", session.data!.id)).data).toEqual([]);
      expect((await admin.from("exercises").select("id").eq("id", seeded.data!.id)).data).toHaveLength(1);
    } finally {
      await deleteTestUser(c);
      await admin.from("exercises").delete().eq("source_id", "acct-test-seeded");
    }
  });
});
