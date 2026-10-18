import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { previousPerformance, recentWorkingSets } from "./history";
import {
  addSet,
  deleteSet,
  finishSession,
  getActiveSession,
  reopenSession,
  repeatLastSet,
  startSession,
  updateSet,
} from "./sessions";

let a: TestUser;
let b: TestUser;
let profile: Profile;
let squat: string;
let plank: string;
const IDS = ["sesstest-squat", "sesstest-plank"];

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  profile = (await a.client.from("profiles").select("*").single()).data!;
  await adminClient().rpc("seed_exercises", {
    p_exercises: [
      { source_id: IDS[0], name: "Sesstest Squat", search_name: "sesstest squat", tracking_mode: "weight_reps", instructions: [], image_paths: [], muscles: [{ group: "quads", role: "primary" }] },
      { source_id: IDS[1], name: "Sesstest Plank", search_name: "sesstest plank", tracking_mode: "duration", instructions: [], image_paths: [], muscles: [{ group: "core", role: "primary" }] },
    ],
  });
  const { data } = await adminClient().from("exercises").select("id, source_id").in("source_id", IDS);
  squat = data!.find((e) => e.source_id === IDS[0])!.id;
  plank = data!.find((e) => e.source_id === IDS[1])!.id;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
  await adminClient().from("exercises").delete().in("source_id", IDS);
});

describe("sessions", () => {
  it("Given Copenhagen at 00:30 on 19 Oct (22:30 UTC on 18 Oct), Then the session day is 2026-10-19", async () => {
    const { session } = await startSession(a.client, profile, {}, new Date("2026-10-18T22:30:00Z"));
    expect(session.local_date).toBe("2026-10-19");
    await finishSession(a.client, session.id);
  });

  it("Given no active session, When a set is logged, Then a session for today starts and holds the set", async () => {
    expect(await getActiveSession(a.client)).toBeNull();
    const set = await addSet(a.client, profile, { exercise_id: squat, weight_kg: 60, reps: 8 });
    const active = await getActiveSession(a.client);
    expect(active?.id).toBe(set.session_id);
    expect(set).toMatchObject({ set_number: 1, weight_kg: 60, reps: 8, set_type: "working", source: "manual" });
  });

  it("Given an active session, When starting another, Then it reports the conflict and creates nothing", async () => {
    const active = await getActiveSession(a.client);
    await expect(startSession(a.client, profile, {})).rejects.toMatchObject({ code: "active_session_exists" });
    expect((await getActiveSession(a.client))?.id).toBe(active?.id);
  });

  it("numbers sets per exercise: two squats then a plank are 1, 2 and 1", async () => {
    const second = await addSet(a.client, profile, { exercise_id: squat, weight_kg: 60, reps: 8 });
    const hold = await addSet(a.client, profile, { exercise_id: plank, duration_s: 60 });
    expect([second.set_number, hold.set_number]).toEqual([2, 1]);
  });

  it("rejects a duration exercise without a duration and impossible values", async () => {
    await expect(addSet(a.client, profile, { exercise_id: plank, reps: 10 })).rejects.toMatchObject({
      code: "invalid",
      details: { duration_s: [expect.stringMatching(/duration is required/i)] },
    });
    await expect(addSet(a.client, profile, { exercise_id: squat, weight_kg: -5, reps: 5 })).rejects.toMatchObject({ code: "invalid" });
    await expect(addSet(a.client, profile, { exercise_id: squat, weight_kg: 50, reps: 250 })).rejects.toMatchObject({ code: "invalid" });
  });

  it("Given the last squat was 60 × 8, When repeating, Then squat set 3 at 60 × 8 is saved", async () => {
    const repeated = await repeatLastSet(a.client, profile, squat);
    expect(repeated).toMatchObject({ exercise_id: squat, set_number: 3, weight_kg: 60, reps: 8 });
  });

  it("edits a set and validates the edit", async () => {
    const active = (await getActiveSession(a.client))!;
    const { data } = await a.client.from("workout_sets").select("id").eq("session_id", active.id).eq("exercise_id", squat).eq("set_number", 3).single();
    const edited = await updateSet(a.client, data!.id, { weight_kg: 62.5, reps: 6, rpe: 8.5 });
    expect(edited).toMatchObject({ weight_kg: 62.5, reps: 6, rpe: 8.5 });
    await expect(updateSet(a.client, data!.id, { reps: 0 })).rejects.toMatchObject({ code: "invalid" });
  });

  it("Given 3 squat sets, When set 2 is deleted, Then the rest are 1 and 2", async () => {
    const active = (await getActiveSession(a.client))!;
    const { data } = await a.client.from("workout_sets").select("id, set_number").eq("session_id", active.id).eq("exercise_id", squat).order("set_number");
    await deleteSet(a.client, data![1]!.id);
    const after = await a.client.from("workout_sets").select("set_number").eq("session_id", active.id).eq("exercise_id", squat).order("set_number");
    expect(after.data?.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it("Given B, When B touches A's session or sets, Then not found", async () => {
    const active = (await getActiveSession(a.client))!;
    const profileB = (await b.client.from("profiles").select("*").single()).data!;
    const { data } = await a.client.from("workout_sets").select("id").eq("session_id", active.id).limit(1).single();
    await expect(finishSession(b.client, active.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(updateSet(b.client, data!.id, { reps: 5 })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteSet(b.client, data!.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await getActiveSession(b.client)).toBeNull();
    expect(profileB.user_id).toBe(b.id);
  });

  it("Given a finished session, Then it accepts no sets until reopened", async () => {
    const active = (await getActiveSession(a.client))!;
    await finishSession(a.client, active.id);
    const { data } = await a.client.from("workout_sessions").select("finished_at").eq("id", active.id).single();
    expect(data?.finished_at).not.toBeNull();
    await expect(repeatLastSet(a.client, profile, squat)).rejects.toMatchObject({ code: "nothing_to_repeat" });
    await reopenSession(a.client, active.id);
    expect((await getActiveSession(a.client))?.id).toBe(active.id);
    await finishSession(a.client, active.id);
  });

  it("Given no active session, When repeating, Then nothing to repeat", async () => {
    await expect(repeatLastSet(a.client, profile, null)).rejects.toMatchObject({ code: "nothing_to_repeat" });
  });

  it("shows the most recent previous session's sets and nothing for a never-done exercise", async () => {
    const set = await addSet(a.client, profile, { exercise_id: squat, weight_kg: 65, reps: 5 });
    const prev = await previousPerformance(a.client, squat, set.session_id);
    expect(prev?.sets.map((s) => [s.weight_kg, s.reps])).toEqual([
      [60, 8],
      [62.5, 6],
    ]);
    expect(await previousPerformance(b.client, squat, null)).toBeNull();
    const recent = await recentWorkingSets(a.client, squat, set.session_id, 3);
    expect(recent).toHaveLength(1);
  });
});
