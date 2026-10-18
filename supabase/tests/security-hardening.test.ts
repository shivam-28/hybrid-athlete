import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../tests/supabase-test-helpers";

const day = { occurred_at: "2026-10-01T05:00:00Z", local_date: "2026-10-01" };
let a: TestUser;
let b: TestUser;
let photoA1: string;
let photoA2: string;
let photoB1: string;

async function photo(user: TestUser, name: string) {
  const { data, error } = await user.client
    .from("progress_photos")
    .insert({ ...day, pose: "front", storage_path: `${user.id}/${name}.jpg`, width: 10, height: 10 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  photoA1 = await photo(a, "a1");
  photoA2 = await photo(a, "a2");
  photoB1 = await photo(b, "b1");
});
afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("progress_photo_analyses references", () => {
  const analysis = (photo_a_id: string, photo_b_id: string) => ({
    ...day,
    photo_a_id,
    photo_b_id,
    observations: ["x"],
    model: "test",
  });

  it("Given B's photo id, When A records an analysis referencing it, Then the write is rejected", async () => {
    const { error } = await a.client.from("progress_photo_analyses").insert(analysis(photoA1, photoB1));
    expect(error).not.toBeNull();
  });

  it("Given two of A's own photos, Then A can record an analysis", async () => {
    const { error } = await a.client.from("progress_photo_analyses").insert(analysis(photoA1, photoA2));
    expect(error).toBeNull();
  });
});

describe("profile free-text arrays", () => {
  it("rejects an allergy entry longer than 60 characters", async () => {
    const { error } = await a.client.from("profiles").update({ allergies: ["x".repeat(61)] }).eq("user_id", a.id);
    expect(error).not.toBeNull();
  });

  it("accepts normal entries", async () => {
    const { error } = await a.client.from("profiles").update({ allergies: ["peanuts"], cuisines: ["danish"] }).eq("user_id", a.id);
    expect(error).toBeNull();
  });
});

describe("activities.fit_file_path", () => {
  const activity = (fit_file_path: string) => ({ ...day, sport: "running", fit_file_path });

  it("rejects a FIT path in another user's folder", async () => {
    const { error } = await a.client.from("activities").insert(activity(`${b.id}/stolen.fit`));
    expect(error?.message).toMatch(/activities_fit_path_owned/);
  });

  it("rejects path traversal out of the owner's folder", async () => {
    const { error } = await a.client.from("activities").insert(activity(`${a.id}/../${b.id}/x.fit`));
    expect(error?.message).toMatch(/activities_fit_path_owned/);
  });

  it("accepts a path in the owner's own folder", async () => {
    const { error } = await a.client.from("activities").insert(activity(`${a.id}/run.fit`));
    expect(error).toBeNull();
  });
});
