import { afterAll, describe, expect, it } from "vitest";
import type { SourceExercise } from "@/lib/exercises/seed-transform";
import { seedExercises } from "../../scripts/seed-exercises";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../tests/supabase-test-helpers";

const fixture = (id: string, name: string, instructions = ["Step one."]): SourceExercise => ({
  id,
  name,
  force: "push",
  level: "beginner",
  mechanic: "compound",
  equipment: "dumbbell",
  primaryMuscles: ["shoulders"],
  secondaryMuscles: ["triceps"],
  instructions,
  category: "strength",
  images: [`${id}/0.jpg`],
});

const IDS = ["seedtest-A", "seedtest-B", "seedtest-C"];
const dataset = () => [fixture(IDS[0]!, "Seedtest Press"), fixture(IDS[1]!, "Seedtest Raise"), fixture(IDS[2]!, "Seedtest Curl")];
let user: TestUser | undefined;

async function seededRows() {
  const { data } = await adminClient().from("exercises").select("id, source_id, name, instructions").in("source_id", IDS).order("source_id");
  return data ?? [];
}

afterAll(async () => {
  await deleteTestUser(user);
  await adminClient().from("exercises").delete().in("source_id", IDS);
});

describe("seedExercises", () => {
  it("Given the seed runs twice on the same dataset, Then counts and ids are identical", async () => {
    await seedExercises(adminClient(), dataset());
    const first = await seededRows();
    await seedExercises(adminClient(), dataset());
    const second = await seededRows();
    expect(first).toHaveLength(3);
    expect(second.map((r) => r.id)).toEqual(first.map((r) => r.id));
    const { data: muscles } = await adminClient().from("exercise_muscles").select("*").eq("exercise_id", first[0]!.id);
    expect(muscles).toHaveLength(2);
  });

  it("Given changed instructions, Then the exercise keeps its id, instructions update, and user data is untouched", async () => {
    user = await createTestUser();
    await user.client.from("profiles").insert(sampleProfile);
    const [press] = await seededRows();
    const session = await user.client.from("workout_sessions").insert({ local_date: "2026-10-18" }).select("id").single();
    const set = await user.client
      .from("workout_sets")
      .insert({ session_id: session.data!.id, exercise_id: press!.id, weight_kg: 12, reps: 15 })
      .select("id")
      .single();
    await user.client.from("exercise_aliases").insert({ phrase_normalised: "seedtest thing", exercise_id: press!.id });
    const custom = await user.client
      .from("exercises")
      .insert({ name: "Seedtest Custom", search_name: "seedtest custom", tracking_mode: "weight_reps" })
      .select("id")
      .single();

    const updated = dataset();
    updated[0] = fixture(IDS[0]!, "Seedtest Press", ["New step one.", "New step two."]);
    await seedExercises(adminClient(), updated);

    const after = await seededRows();
    expect(after[0]!.id).toBe(press!.id);
    expect(after[0]!.instructions).toEqual(["New step one.", "New step two."]);
    expect((await user.client.from("workout_sets").select("exercise_id").eq("id", set.data!.id).single()).data?.exercise_id).toBe(press!.id);
    expect((await user.client.from("exercise_aliases").select("id")).data).toHaveLength(1);
    expect((await user.client.from("exercises").select("id").eq("id", custom.data!.id)).data).toHaveLength(1);
  });
});
