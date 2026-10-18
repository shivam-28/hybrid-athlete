import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/server/auth";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { MissingAiKeyError } from "@/server/ai/client";
import { getActiveSession } from "./sessions";
import { confirmUtterance, processUtterance, type AiFallback } from "./voice";

let u: TestUser;
let profile: Profile;
const ex: Record<string, string> = {};
const FIXTURES = [
  ["voicetest-squat", "Voicetest Squat", "weight_reps"],
  ["voicetest-dsp", "Voicetest Dumbbell Shoulder Press", "weight_reps"],
  ["voicetest-bsp", "Voicetest Barbell Shoulder Press", "weight_reps"],
  ["voicetest-csp", "Voicetest Cable Shoulder Press", "weight_reps"],
  ["voicetest-plank", "Voicetest Plank", "duration"],
] as const;

const noAi: AiFallback = vi.fn(async () => {
  throw new MissingAiKeyError();
});

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
  await adminClient().rpc("seed_exercises", {
    p_exercises: FIXTURES.map(([source_id, name, tracking_mode]) => ({
      source_id,
      name,
      search_name: name.toLowerCase(),
      tracking_mode,
      instructions: [],
      image_paths: [],
      muscles: [{ group: "core", role: "primary" }],
    })),
  });
  const { data } = await adminClient().from("exercises").select("id, source_id").in("source_id", FIXTURES.map((f) => f[0]));
  for (const row of data!) ex[row.source_id!] = row.id;
});

afterAll(async () => {
  await deleteTestUser(u);
  await adminClient().from("exercises").delete().in("source_id", FIXTURES.map((f) => f[0]));
});

beforeEach(() => {
  vi.mocked(noAi).mockClear();
});

describe("processUtterance", () => {
  it("Given 'same again' with no prior set, Then nothing is saved", async () => {
    const outcome = await processUtterance(u.client, profile, { transcript: "same again", source: "voice" }, noAi);
    expect(outcome).toEqual({ status: "nothing_to_repeat" });
  });

  it("Given an unambiguous phrase, Then the set auto-saves into a new session with transcript and source", async () => {
    const outcome = await processUtterance(u.client, profile, { transcript: "voicetest squat 60 kg 8 reps", source: "voice" }, noAi);
    expect(outcome).toMatchObject({ status: "saved", sets: [{ exerciseName: "Voicetest Squat", set_number: 1, weight_kg: 60, reps: 8 }] });
    const active = await getActiveSession(u.client);
    const { data } = await u.client.from("workout_sets").select("transcript, source").eq("session_id", active!.id).single();
    expect(data).toEqual({ transcript: "voicetest squat 60 kg 8 reps", source: "voice" });
    expect(noAi).not.toHaveBeenCalled();
  });

  it("Given 'same again' after a squat, Then another squat set is saved", async () => {
    const outcome = await processUtterance(u.client, profile, { transcript: "same again", source: "voice" }, noAi);
    expect(outcome).toMatchObject({ status: "saved", sets: [{ exerciseName: "Voicetest Squat", set_number: 2, weight_kg: 60, reps: 8 }] });
  });

  it("Given values only, Then the open exercise is used", async () => {
    const outcome = await processUtterance(
      u.client,
      profile,
      { transcript: "8 reps at 62.5 kilos", source: "text", activeExerciseId: ex["voicetest-squat"] },
      noAi,
    );
    expect(outcome).toMatchObject({ status: "saved", sets: [{ exerciseName: "Voicetest Squat", set_number: 3, weight_kg: 62.5 }] });
  });

  it("Given an ambiguous phrase and no AI key, Then a confirmation draft with top-3 candidates and parsed values, nothing saved", async () => {
    const before = (await u.client.from("workout_sets").select("id")).data!.length;
    const outcome = await processUtterance(u.client, profile, { transcript: "voicetest shoulder press 12 kg 15 reps", source: "voice" }, noAi);
    expect(outcome.status).toBe("needs_confirmation");
    if (outcome.status !== "needs_confirmation") return;
    expect(outcome.draft.candidates.length).toBeLessThanOrEqual(3);
    expect(outcome.draft.candidates.map((c) => c.name)).toContain("Voicetest Dumbbell Shoulder Press");
    expect(outcome.draft).toMatchObject({ parsedBy: "grammar", sets: [{ weight_kg: 12, reps: 15 }], aiUnavailable: false });
    expect((await u.client.from("workout_sets").select("id")).data!.length).toBe(before);
  });

  it("Given the AI fallback recovers a messy phrase, Then the result is shown on the confirmation card, not saved", async () => {
    const ai: AiFallback = vi.fn(async ({ candidates }) => ({
      exerciseId: candidates.find((c: { name: string }) => c.name === "Voicetest Dumbbell Shoulder Press")!.id,
      sets: [{ weight_kg: 12, reps: 15, duration_s: null, distance_m: null }],
    }));
    const outcome = await processUtterance(
      u.client,
      profile,
      { transcript: "did twelve on the voicetest overhead dumbbell thing with the twelves, fifteen of them", source: "voice" },
      ai,
    );
    expect(ai).toHaveBeenCalledOnce();
    expect(outcome).toMatchObject({
      status: "needs_confirmation",
      draft: { parsedBy: "ai", exerciseId: ex["voicetest-dsp"], sets: [{ weight_kg: 12, reps: 15 }] },
    });
  });

  it("Given the AI fails, Then the deterministic draft is shown with an AI-unavailable notice", async () => {
    const ai: AiFallback = vi.fn(async () => {
      throw new Error("timeout");
    });
    const outcome = await processUtterance(u.client, profile, { transcript: "voicetest shoulder press 12 kg 15 reps", source: "voice" }, ai);
    expect(outcome).toMatchObject({ status: "needs_confirmation", draft: { parsedBy: "grammar", aiUnavailable: true } });
  });

  it("Given a resolved exercise with missing values, Then it asks for confirmation", async () => {
    const outcome = await processUtterance(u.client, profile, { transcript: "voicetest plank", source: "voice" }, noAi);
    expect(outcome).toMatchObject({ status: "needs_confirmation", draft: { exerciseId: ex["voicetest-plank"] } });
  });
});

describe("confirmUtterance and aliases", () => {
  it("Given the user confirms Dumbbell Shoulder Press for 'shoulder bench press', Then it saves and the phrase auto-saves next time", async () => {
    const saved = await confirmUtterance(u.client, profile, {
      phrase: "shoulder bench press",
      exerciseId: ex["voicetest-dsp"]!,
      sets: [{ weight_kg: 12, reps: 15, duration_s: null, distance_m: null }],
      source: "voice",
      transcript: "shoulder bench press 1st set 12 kg 15 reps done",
    });
    expect(saved).toMatchObject({ status: "saved", sets: [{ exerciseName: "Voicetest Dumbbell Shoulder Press", reps: 15 }] });
    const { data: aliases } = await u.client.from("exercise_aliases").select("phrase_normalised, exercise_id");
    expect(aliases).toEqual([{ phrase_normalised: "shoulder bench press", exercise_id: ex["voicetest-dsp"] }]);

    const next = await processUtterance(u.client, profile, { transcript: "shoulder bench press 14 kg 10 reps", source: "voice" }, noAi);
    expect(next).toMatchObject({ status: "saved", sets: [{ exerciseName: "Voicetest Dumbbell Shoulder Press", weight_kg: 14, reps: 10 }] });
    expect(noAi).not.toHaveBeenCalled();
  });

  it("rejects confirmed values that are invalid for the exercise", async () => {
    await expect(
      confirmUtterance(u.client, profile, {
        phrase: null,
        exerciseId: ex["voicetest-plank"]!,
        sets: [{ weight_kg: null, reps: 10, duration_s: null, distance_m: null }],
        source: "text",
        transcript: "plank",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});
