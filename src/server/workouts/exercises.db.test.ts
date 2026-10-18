import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import {
  createCustomExercise,
  deleteCustomExercise,
  getExercise,
  searchExercises,
  updateCustomExercise,
} from "./exercises";
import { addSet } from "./sessions";

let a: TestUser;
let b: TestUser;
const FIXTURE_IDS = ["matchtest-dsp", "matchtest-bsp", "matchtest-lat"];

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  const { error } = await adminClient().rpc("seed_exercises", {
    p_exercises: [
      { source_id: FIXTURE_IDS[0], name: "Dumbbell Shoulder Press", search_name: "dumbbell shoulder press", equipment: "dumbbell", tracking_mode: "weight_reps", instructions: [], image_paths: [], muscles: [{ group: "shoulders", role: "primary" }, { group: "triceps", role: "secondary" }] },
      { source_id: FIXTURE_IDS[1], name: "Barbell Shoulder Press", search_name: "barbell shoulder press", equipment: "barbell", tracking_mode: "weight_reps", instructions: [], image_paths: [], muscles: [{ group: "shoulders", role: "primary" }] },
      { source_id: FIXTURE_IDS[2], name: "Dumbbell Lateral Thing", search_name: "dumbbell lateral thing", equipment: "dumbbell", tracking_mode: "weight_reps", instructions: [], image_paths: [], muscles: [{ group: "shoulders", role: "primary" }] },
    ],
  });
  if (error) throw error;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
  await adminClient().from("exercises").delete().in("source_id", FIXTURE_IDS);
});

describe("searchExercises", () => {
  it("Given a typo, When searching 'dumbel shoulder pres', Then Dumbbell Shoulder Press is in the top 5", async () => {
    const results = await searchExercises(a.client, { q: "dumbel shoulder pres" });
    expect(results.slice(0, 5).map((r) => r.name)).toContain("Dumbbell Shoulder Press");
  });

  it("Given filters shoulders + dumbbell, Then every result has shoulders and dumbbell equipment", async () => {
    const results = await searchExercises(a.client, { muscle: "shoulders", equipment: "dumbbell", limit: 100 });
    expect(results.length).toBeGreaterThan(0);
    const { data: muscles } = await a.client.from("exercise_muscles").select("exercise_id, muscle_group").in("exercise_id", results.map((r) => r.id));
    for (const r of results) {
      expect(r.equipment).toBe("dumbbell");
      expect(muscles?.some((m) => m.exercise_id === r.id && m.muscle_group === "shoulders")).toBe(true);
    }
  });
});

describe("custom exercises", () => {
  let landmine: string;

  it("Given A creates Landmine Rotation, Then A finds it and B does not", async () => {
    const created = await createCustomExercise(a.client, {
      name: "Landmine Rotation",
      equipment: "barbell",
      tracking_mode: "weight_reps",
      primary: ["core"],
      secondary: ["shoulders"],
    });
    landmine = created.id;
    expect((await searchExercises(a.client, { q: "landmine rotation" })).map((r) => r.name)).toContain("Landmine Rotation");
    expect((await searchExercises(b.client, { q: "landmine rotation" })).map((r) => r.name)).not.toContain("Landmine Rotation");
    expect(await getExercise(b.client, landmine)).toBeNull();
    expect((await getExercise(a.client, landmine))?.muscles).toEqual([
      { muscle_group: "core", role: "primary" },
      { muscle_group: "shoulders", role: "secondary" },
    ]);
  });

  it("rejects a custom exercise without a primary muscle group", async () => {
    await expect(
      createCustomExercise(a.client, { name: "Nothing", equipment: null, tracking_mode: "duration", primary: [], secondary: [] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("Given an edit, Then name and muscles update", async () => {
    await updateCustomExercise(a.client, landmine, {
      name: "Landmine Twist",
      equipment: "barbell",
      tracking_mode: "weight_reps",
      primary: ["core"],
      secondary: [],
    });
    expect(await getExercise(a.client, landmine)).toMatchObject({ name: "Landmine Twist", muscles: [{ muscle_group: "core", role: "primary" }] });
  });

  it("Given a seeded exercise, When a user edits or deletes it, Then not found", async () => {
    const [seeded] = await searchExercises(a.client, { q: "barbell shoulder press" });
    await expect(updateCustomExercise(a.client, seeded!.id, { name: "x", equipment: null, tracking_mode: "duration", primary: ["core"], secondary: [] })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteCustomExercise(a.client, seeded!.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("Given an unused custom exercise, When deleted, Then it is removed permanently", async () => {
    const temp = await createCustomExercise(a.client, { name: "Temp Move", equipment: null, tracking_mode: "duration", primary: ["core"], secondary: [] });
    expect(await deleteCustomExercise(a.client, temp.id)).toBe("deleted");
    expect((await adminClient().from("exercises").select("id").eq("id", temp.id)).data).toEqual([]);
  });

  it("Given a custom exercise with logged sets, When deleted, Then it is archived, hidden from search, and history remains", async () => {
    const profile = { ...sampleProfile, user_id: a.id } as never;
    const set = await addSet(a.client, profile, { exercise_id: landmine, weight_kg: 20, reps: 10 });
    expect(await deleteCustomExercise(a.client, landmine)).toBe("archived");
    expect((await searchExercises(a.client, { q: "landmine twist" })).map((r) => r.id)).not.toContain(landmine);
    expect((await a.client.from("workout_sets").select("id").eq("id", set.id)).data).toHaveLength(1);
    await expect(addSet(a.client, profile, { exercise_id: landmine, weight_kg: 20, reps: 10 })).rejects.toMatchObject({ code: "not_found" });
  });
});
