import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;
const ids: Record<string, string> = {};
const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/jpeg" });

async function insertOne(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table as never).insert(row as never).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  const day = { occurred_at: "2026-10-01T05:00:00Z", local_date: "2026-10-01" };
  ids.body_weights = await insertOne(a, "body_weights", { ...day, weight_kg: 78.4 });
  ids.body_measurements = await insertOne(a, "body_measurements", { ...day, waist_cm: 86.5 });
  ids.body_composition_tests = await insertOne(a, "body_composition_tests", { ...day, method: "dexa", weight_kg: 79, body_fat_pct: 18.5 });
  ids.progress_photos = await insertOne(a, "progress_photos", { ...day, pose: "front", storage_path: `${a.id}/p1.jpg`, width: 10, height: 10 });
  const photoB = await insertOne(a, "progress_photos", { ...day, pose: "front", storage_path: `${a.id}/p2.jpg`, width: 10, height: 10 });
  ids.progress_photo_analyses = await insertOne(a, "progress_photo_analyses", {
    photo_a_id: ids.progress_photos,
    photo_b_id: photoB,
    observations: ["More visible shoulder definition."],
    model: "test",
    ...day,
  });
  ids.body_goals = await insertOne(a, "body_goals", { ...day, goal_weight_kg: 76 });
  for (const bucket of ["body-comp-docs", "progress-photos"]) {
    const { error } = await a.client.storage.from(bucket).upload(`${a.id}/own.jpg`, png());
    if (error) throw error;
  }
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const TABLES = [
  "body_weights",
  "body_measurements",
  "body_composition_tests",
  "progress_photos",
  "progress_photo_analyses",
  "body_goals",
] as const;

describe("body data isolation", () => {
  it.each(TABLES)("Given A has %s rows, When B selects them, Then nothing is returned", async (table) => {
    const { data, error } = await b.client.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await a.client.from(table).select("*")).data?.length).toBeGreaterThan(0);
  });

  it.each(TABLES)("When B updates or deletes A's %s row, Then nothing changes", async (table) => {
    await b.client.from(table).update({ local_date: "2020-01-01" }).eq("id", ids[table]!);
    await b.client.from(table).delete().eq("id", ids[table]!);
    const { data } = await a.client.from(table).select("local_date").eq("id", ids[table]!).single();
    expect(data?.local_date).toBe("2026-10-01");
  });

  it("When B inserts a weight owned by A, Then the write is rejected", async () => {
    const { error } = await b.client
      .from("body_weights")
      .insert({ user_id: a.id, occurred_at: "2026-10-01T05:00:00Z", local_date: "2026-10-01", weight_kg: 70 });
    expect(error).not.toBeNull();
  });

  it("When B reads the daily_body_weight view, Then A's weights are not visible", async () => {
    expect((await b.client.from("daily_body_weight").select("*")).data).toEqual([]);
    expect((await a.client.from("daily_body_weight").select("*")).data?.length).toBe(1);
  });

  it("When anon reads body tables, Then nothing is returned", async () => {
    for (const table of TABLES) expect((await anonClient().from(table).select("*")).data ?? []).toEqual([]);
  });

  it("enforces value ranges at the database level", async () => {
    const day = { occurred_at: "2026-10-02T05:00:00Z", local_date: "2026-10-02" };
    expect((await a.client.from("body_weights").insert({ ...day, weight_kg: 10 })).error).not.toBeNull();
    expect((await a.client.from("body_measurements").insert({ ...day })).error).not.toBeNull();
    expect((await a.client.from("body_measurements").insert({ ...day, waist_cm: 300 })).error).not.toBeNull();
    expect((await a.client.from("body_goals").insert({ ...day })).error).not.toBeNull();
  });

  it("allows only one active goal per user", async () => {
    const { error } = await a.client
      .from("body_goals")
      .insert({ occurred_at: "2026-10-02T05:00:00Z", local_date: "2026-10-02", goal_weight_kg: 74 });
    expect(error?.code).toBe("23505");
  });
});

describe("body storage policies", () => {
  it.each(["body-comp-docs", "progress-photos"])("Given A's file in %s, Then only A can read, list and delete it", async (bucket) => {
    expect((await a.client.storage.from(bucket).download(`${a.id}/own.jpg`)).data).not.toBeNull();
    expect((await b.client.storage.from(bucket).download(`${a.id}/own.jpg`)).data).toBeNull();
    expect((await b.client.storage.from(bucket).list(a.id)).data ?? []).toEqual([]);
    expect((await anonClient().storage.from(bucket).download(`${a.id}/own.jpg`)).data).toBeNull();
    await b.client.storage.from(bucket).remove([`${a.id}/own.jpg`]);
    expect((await a.client.storage.from(bucket).download(`${a.id}/own.jpg`)).data).not.toBeNull();
  });

  it.each(["body-comp-docs", "progress-photos"])("When B uploads into A's folder in %s, Then it is rejected", async (bucket) => {
    expect((await b.client.storage.from(bucket).upload(`${a.id}/evil.jpg`, png())).error).not.toBeNull();
    expect((await b.client.storage.from(bucket).upload(`evil.jpg`, png())).error).not.toBeNull();
  });

  it("lets the owner delete their own file", async () => {
    await a.client.storage.from("progress-photos").upload(`${a.id}/tmp.jpg`, png());
    await a.client.storage.from("progress-photos").remove([`${a.id}/tmp.jpg`]);
    expect((await a.client.storage.from("progress-photos").download(`${a.id}/tmp.jpg`)).data).toBeNull();
  });
});
