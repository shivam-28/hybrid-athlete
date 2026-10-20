import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { ModelWeekPlan } from "@/lib/coach/plan-schema";
import { InvalidAiKeyError, MissingAiKeyError } from "@/server/ai/client";
import type { StructuredClient } from "@/server/ai/structured";
import type { Profile } from "@/server/auth";
import { createCustomExercise } from "@/server/workouts/exercises";
import { CoachError } from "./errors";
import { generatePlan } from "./generate";
import { savePreferences } from "./preferences";
import { refusingAi } from "../../../tests/ai-test-helpers";

const WEEK = "2026-10-19";
const NOW = new Date("2026-10-18T10:00:00Z");
let user: TestUser;
let profile: Profile;

const EXERCISES = [
  { name: "Coach Squat", primary: ["quads", "glutes"] },
  { name: "Coach RDL", primary: ["hamstrings"] },
  { name: "Coach Bench", primary: ["chest"] },
  { name: "Coach Row", primary: ["back"] },
  { name: "Coach Press", primary: ["shoulders"] },
  { name: "Coach Plank", primary: ["core"] },
] as const;

type Request = { messages: { content: { type: string; text?: string }[] }[] };
const promptText = (req: Request) => req.messages[0]!.content.map((c) => c.text ?? "").join("\n");
const refFor = (text: string, name: string) => text.match(new RegExp(`(e\\d+): ${name}\\b`))![1]!;

/** Mon full · Wed easy 3 km · Thu full · Sat mobility · rest otherwise (compliant on a 0 km base). */
function plan(text: string, opts: { restDay?: boolean; unknownRef?: boolean } = {}): ModelWeekPlan {
  const exercises = EXERCISES.map((e) => ({ ref: opts.unknownRef ? "e999" : refFor(text, e.name), sets: 3, rep_min: 8, rep_max: 12 }));
  const full = { type: "strength" as const, title: "Full body", focus: "full" as const, duration_min: 60, exercises, notes: null };
  const rest = { type: "rest" as const };
  const mobility = { type: "mobility" as const, title: "Mobility", duration_min: 20, notes: null };
  const easy = { type: "run" as const, title: "Easy run", run_type: "easy" as const, duration_min: null, distance_km: 3, hr_zone: 2, pace: null, notes: null };
  const filler = opts.restDay === false ? mobility : rest;
  return { days: [[full], [filler], [easy], [full], [filler], [mobility], [filler]].map((sessions) => ({ sessions })) };
}

function mockClient(...responses: ((text: string) => ModelWeekPlan | null)[]) {
  const parse = vi.fn(async (req: Request) => ({ stop_reason: "end_turn", parsed_output: responses.shift()!(promptText(req)) }));
  const client = { beta: { messages: { parse } } } as unknown as StructuredClient;
  return { parse, runAi: async <T,>(call: (c: StructuredClient) => Promise<T>) => call(client) };
}

const plans = async () => (await user.client.from("training_plans").select("id, status, warnings, week_start").eq("week_start", WEEK)).data ?? [];

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
  profile = (await user.client.from("profiles").select("*").single()).data!;
  for (const e of EXERCISES) {
    await createCustomExercise(user.client, { name: e.name, equipment: "body only", tracking_mode: "weight_reps", primary: [...e.primary], secondary: [] });
  }
});
afterAll(() => deleteTestUser(user));

describe("generatePlan without preferences", () => {
  it("Given no saved preferences, Then generation is rejected before any AI call", async () => {
    const { parse, runAi } = mockClient();
    await expect(generatePlan(user.client, profile, WEEK, runAi, NOW)).rejects.toMatchObject({ code: "no_preferences" });
    expect(parse).not.toHaveBeenCalled();
  });
});

describe("generatePlan", () => {
  beforeAll(async () => {
    await savePreferences(user.client, profile, { days_per_week: 6, max_session_min: 90, long_run_weekday: "7", equipment: "home", race_distance: "none" }, NOW);
  });
  beforeEach(async () => {
    await user.client.from("training_plans").delete().eq("week_start", WEEK);
  });

  it("Given a compliant first response, Then one call is made and a draft without warnings is saved", async () => {
    const { parse, runAi } = mockClient((t) => plan(t));
    const result = await generatePlan(user.client, profile, WEEK, runAi, NOW);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
    const saved = await plans();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "draft", warnings: [] });

    const { data: sessions } = await user.client.from("planned_sessions").select("local_date, day_index, type").eq("plan_id", saved[0]!.id).order("day_index");
    expect(sessions!.find((s) => s.type === "run")).toMatchObject({ local_date: "2026-10-21", day_index: 2 });
    expect(sessions!.find((s) => s.day_index === 6)!.local_date).toBe("2026-10-25");
  });

  it("only offers the model a closed exercise list and sends no raw rows", async () => {
    const { parse, runAi } = mockClient((t) => plan(t));
    await generatePlan(user.client, profile, WEEK, runAi, NOW);
    const text = promptText(parse.mock.calls[0]![0] as Request);
    expect(text).toMatch(/e\d+: Coach Squat/);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no uuids
  });

  it("Given a violating plan then a compliant repair, Then two calls are made and no warnings are saved", async () => {
    const { parse, runAi } = mockClient((t) => plan(t, { restDay: false }), (t) => plan(t));
    const result = await generatePlan(user.client, profile, WEEK, runAi, NOW);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(promptText(parse.mock.calls[1]![0] as Request)).toMatch(/Rule 2/);
    expect(result.warnings).toEqual([]);
  });

  it("Given a violating plan twice, Then the draft is saved with warnings", async () => {
    const { parse, runAi } = mockClient((t) => plan(t, { restDay: false }), (t) => plan(t, { restDay: false }));
    const result = await generatePlan(user.client, profile, WEEK, runAi, NOW);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(result.warnings.map((w) => w.rule)).toContain("rest_day");
    expect((await plans())[0]!.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: "rest_day" })]));
  });

  it("Given an unknown exercise then a valid repair, Then the repaired plan is saved", async () => {
    const { parse, runAi } = mockClient((t) => plan(t, { unknownRef: true }), (t) => plan(t));
    await generatePlan(user.client, profile, WEEK, runAi, NOW);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(promptText(parse.mock.calls[1]![0] as Request)).toMatch(/e999/);
    expect(await plans()).toHaveLength(1);
  });

  it("Given unparseable output twice, Then an error is raised and nothing is saved", async () => {
    const { parse, runAi } = mockClient(() => null, (t) => plan(t, { unknownRef: true }));
    await expect(generatePlan(user.client, profile, WEEK, runAi, NOW)).rejects.toMatchObject({ code: "plan_invalid" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(await plans()).toEqual([]);
  });

  it("Given no AI key, Then the user is pointed to Settings and no call is made", async () => {
    const runAi = async () => {
      throw new MissingAiKeyError();
    };
    const error = await generatePlan(user.client, profile, WEEK, runAi, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(CoachError);
    expect(error).toMatchObject({ code: "missing_ai_key" });
    expect(error.message).toMatch(/Settings/);
  });

  it("Given Claude declines to draft the plan, Then ai_declined is raised and no plan is saved", async () => {
    await user.client.from("training_plans").delete().eq("week_start", WEEK);
    await expect(generatePlan(user.client, profile, WEEK, refusingAi().run, NOW)).rejects.toMatchObject({ code: "ai_declined" });
    expect(await plans()).toEqual([]);
  });

  it("Given Anthropic rejects the key, Then it maps to key no longer valid", async () => {
    const runAi = async () => {
      throw new InvalidAiKeyError();
    };
    await expect(generatePlan(user.client, profile, WEEK, runAi, NOW)).rejects.toMatchObject({ code: "ai_key_invalid" });
  });

  it("Given a regenerate, Then the previous draft for the week is replaced", async () => {
    await generatePlan(user.client, profile, WEEK, mockClient((t) => plan(t)).runAi, NOW);
    await generatePlan(user.client, profile, WEEK, mockClient((t) => plan(t)).runAi, NOW);
    expect((await plans()).filter((p) => p.status === "draft")).toHaveLength(1);
  });

  it("rejects a week start that is not a Monday", async () => {
    await expect(generatePlan(user.client, profile, "2026-10-20", mockClient().runAi, NOW)).rejects.toMatchObject({ code: "invalid" });
  });
});
