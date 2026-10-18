import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../tests/supabase-test-helpers";

let u: TestUser;
let bench: string;
let squat: string;

async function seeded(sourceId: string, name: string, muscles: [string, "primary" | "secondary"][]) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("exercises")
    .upsert({ source_id: sourceId, name, search_name: name.toLowerCase(), tracking_mode: "weight_reps" }, { onConflict: "source_id" })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("exercise_muscles").delete().eq("exercise_id", data.id);
  await admin.from("exercise_muscles").insert(muscles.map(([g, role]) => ({ exercise_id: data.id, muscle_group: g as never, role })));
  return data.id;
}

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  bench = await seeded("fn-test-bench", "FnTest Bench", [["chest", "primary"], ["triceps", "secondary"], ["shoulders", "secondary"]]);
  squat = await seeded("fn-test-squat", "FnTest Squat", [["quads", "primary"]]);
});

afterAll(async () => {
  await deleteTestUser(u);
  await adminClient().from("exercises").delete().in("source_id", ["fn-test-bench", "fn-test-squat"]);
});

describe("delete_set", () => {
  it("Given 3 squat sets, When set 2 is deleted, Then the rest are renumbered 1 and 2", async () => {
    const s = await u.client.from("workout_sessions").insert({ local_date: "2026-10-12" }).select("id").single();
    const ids: string[] = [];
    for (const reps of [8, 7, 6]) {
      const { data } = await u.client.from("workout_sets").insert({ session_id: s.data!.id, exercise_id: squat, weight_kg: 60, reps }).select("id").single();
      ids.push(data!.id);
    }
    const { error } = await u.client.rpc("delete_set", { p_set_id: ids[1]! });
    expect(error).toBeNull();
    const { data } = await u.client.from("workout_sets").select("reps, set_number").eq("session_id", s.data!.id).order("set_number");
    expect(data).toEqual([{ reps: 8, set_number: 1 }, { reps: 6, set_number: 2 }]);
    await u.client.rpc("finish_session", { p_session_id: s.data!.id });
  });
});

describe("weekly_muscle_volume", () => {
  it("Given 3 bench working sets and squat 2 warm-up + 3 working sets, Then primary counts 1, secondary 0.5, warm-ups 0", async () => {
    const s = await u.client.from("workout_sessions").insert({ local_date: "2026-10-14" }).select("id").single();
    if (s.error) throw s.error;
    const sid = s.data!.id;
    for (let i = 0; i < 3; i++) await u.client.from("workout_sets").insert({ session_id: sid, exercise_id: bench, weight_kg: 50, reps: 8 });
    for (let i = 0; i < 2; i++) await u.client.from("workout_sets").insert({ session_id: sid, exercise_id: squat, weight_kg: 20, reps: 10, set_type: "warmup" });
    for (let i = 0; i < 3; i++) await u.client.from("workout_sets").insert({ session_id: sid, exercise_id: squat, weight_kg: 60, reps: 8 });
    await u.client.rpc("finish_session", { p_session_id: sid });

    const { data, error } = await u.client.rpc("weekly_muscle_volume", { p_week_start: "2026-10-12" });
    expect(error).toBeNull();
    const volume = Object.fromEntries((data ?? []).map((r) => [r.muscle_group, Number(r.sets)]));
    // The delete_set test's squat sets (6 Oct 12) are in the same ISO week: 2 more working sets.
    expect(volume).toEqual({ chest: 3, triceps: 1.5, shoulders: 1.5, quads: 5 });
  });

  it("Given a different week, Then that week's volume is empty", async () => {
    const { data } = await u.client.rpc("weekly_muscle_volume", { p_week_start: "2026-10-19" });
    expect(data).toEqual([]);
  });
});
