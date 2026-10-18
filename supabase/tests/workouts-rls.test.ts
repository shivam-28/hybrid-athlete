import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  sampleProfile,
  type TestUser,
} from "../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;
let seededId: string;
let customA: string;
let sessionA: string;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);

  const admin = adminClient();
  const { data: seeded, error } = await admin
    .from("exercises")
    .insert({ source_id: "rls-test-seeded", name: "RLS Seeded Press", search_name: "rls seeded press", tracking_mode: "weight_reps" })
    .select("id")
    .single();
  if (error) throw error;
  seededId = seeded.id;
  await admin.from("exercise_muscles").insert({ exercise_id: seededId, muscle_group: "chest", role: "primary" });

  const custom = await a.client
    .from("exercises")
    .insert({ name: "Landmine Rotation", search_name: "landmine rotation", tracking_mode: "weight_reps" })
    .select("id")
    .single();
  if (custom.error) throw custom.error;
  customA = custom.data.id;
  await a.client.from("exercise_muscles").insert({ exercise_id: customA, muscle_group: "core", role: "primary" });

  const session = await a.client.from("workout_sessions").insert({ local_date: "2026-10-18" }).select("id").single();
  if (session.error) throw session.error;
  sessionA = session.data.id;
  const set = await a.client.from("workout_sets").insert({ session_id: sessionA, exercise_id: customA, weight_kg: 20, reps: 10 });
  if (set.error) throw set.error;
  await a.client.from("exercise_aliases").insert({ phrase_normalised: "landmine", exercise_id: customA });
  await a.client.from("exercise_settings").insert({ exercise_id: customA, rep_min: 8, rep_max: 12 });
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
  await adminClient().from("exercises").delete().eq("id", seededId);
});

describe("exercises RLS", () => {
  it("Given a seeded exercise, Then every signed-in user can read it", async () => {
    for (const u of [a, b]) {
      const { data } = await u.client.from("exercises").select("id").eq("id", seededId);
      expect(data).toHaveLength(1);
    }
  });

  it("Given a seeded exercise, When a user edits or deletes it, Then it is unchanged", async () => {
    await a.client.from("exercises").update({ name: "hacked" }).eq("id", seededId);
    await a.client.from("exercises").delete().eq("id", seededId);
    const { data } = await adminClient().from("exercises").select("name").eq("id", seededId).single();
    expect(data?.name).toBe("RLS Seeded Press");
  });

  it("Given A's custom exercise, When B queries it or its muscles, Then nothing is returned", async () => {
    expect((await b.client.from("exercises").select("id").eq("id", customA)).data).toEqual([]);
    expect((await b.client.from("exercise_muscles").select("*").eq("exercise_id", customA)).data).toEqual([]);
    expect((await a.client.from("exercise_muscles").select("*").eq("exercise_id", customA)).data).toHaveLength(1);
  });

  it("When B attaches muscles to A's exercise or a seeded one, Then the write is rejected", async () => {
    const r1 = await b.client.from("exercise_muscles").insert({ exercise_id: customA, muscle_group: "back", role: "secondary" });
    const r2 = await b.client.from("exercise_muscles").insert({ exercise_id: seededId, muscle_group: "back", role: "secondary" });
    expect(r1.error).not.toBeNull();
    expect(r2.error).not.toBeNull();
  });

  it("When a user inserts a row pretending to be seeded, Then it is rejected", async () => {
    const { error } = await b.client
      .from("exercises")
      .insert({ source_id: "fake", user_id: null, name: "Fake", search_name: "fake", tracking_mode: "duration" });
    expect(error).not.toBeNull();
  });
});

describe("workout tables RLS", () => {
  it.each(["workout_sessions", "workout_sets", "exercise_aliases", "exercise_settings"] as const)(
    "Given A has %s rows, When B and anon query, Then nothing is returned",
    async (table) => {
      expect((await a.client.from(table).select("id")).data?.length).toBeGreaterThan(0);
      expect((await b.client.from(table).select("id")).data).toEqual([]);
      expect((await anonClient().from(table).select("id")).data ?? []).toEqual([]);
    },
  );

  it("When B logs a set into A's session, Then it is rejected", async () => {
    const { error } = await b.client.from("workout_sets").insert({ session_id: sessionA, exercise_id: seededId, weight_kg: 10, reps: 5 });
    expect(error).not.toBeNull();
  });

  it("Given an active session, When the user starts a second one, Then the database refuses", async () => {
    const { error } = await a.client.from("workout_sessions").insert({ local_date: "2026-10-18" });
    expect(error?.code).toBe("23505");
  });

  it("rejects impossible values at the database level", async () => {
    const bad = [{ weight_kg: -5, reps: 5 }, { weight_kg: 10, reps: 250 }, { weight_kg: 10, reps: 5, rpe: 7.3 }];
    for (const values of bad) {
      const { error } = await a.client.from("workout_sets").insert({ session_id: sessionA, exercise_id: seededId, ...values });
      expect(error).not.toBeNull();
    }
  });

  it("assigns set numbers per exercise and copies the session's local date", async () => {
    await a.client.from("workout_sets").insert({ session_id: sessionA, exercise_id: customA, weight_kg: 20, reps: 9 });
    await a.client.from("workout_sets").insert({ session_id: sessionA, exercise_id: seededId, weight_kg: 50, reps: 8 });
    const { data } = await a.client
      .from("workout_sets")
      .select("exercise_id, set_number, local_date")
      .eq("session_id", sessionA)
      .order("created_at");
    expect(data?.map((s) => [s.exercise_id === customA ? "custom" : "seeded", s.set_number])).toEqual([
      ["custom", 1],
      ["custom", 2],
      ["seeded", 1],
    ]);
    expect(data?.every((s) => s.local_date === "2026-10-18")).toBe(true);
  });
});
