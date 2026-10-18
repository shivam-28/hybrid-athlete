import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { getActiveGoal, listGoalHistory, setGoal } from "./goals";
import { getGoalState } from "./read";

let u: TestUser;
let fresh: TestUser;
let profile: Profile;
let freshProfile: Profile;
const NOW = new Date("2026-10-18T10:00:00Z");
const TODAY = "2026-10-18";

beforeAll(async () => {
  u = await createTestUser();
  fresh = await createTestUser();
  for (const x of [u, fresh]) await x.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
  freshProfile = (await fresh.client.from("profiles").select("*").single()).data!;
  // 15 days at a steady 80.0 kg → trend 80.0
  const rows = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(Date.parse("2026-10-04T05:00:00Z") + i * 86_400_000);
    return { occurred_at: d.toISOString(), local_date: d.toISOString().slice(0, 10), weight_kg: 80 };
  });
  await u.client.from("body_weights").insert(rows);
});

afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(fresh);
});

describe("setGoal", () => {
  it("Given neither weight nor body fat, Then it is rejected", async () => {
    await expect(setGoal(u.client, profile, { unit: "kg", target_date: "" }, NOW)).rejects.toMatchObject({ code: "invalid" });
  });

  it.each(["2026-10-17", "2026-10-18"])("Given target date %s (not after today), Then it is rejected", async (target_date) => {
    await expect(setGoal(u.client, profile, { unit: "kg", goal_weight: 76, target_date }, NOW)).rejects.toMatchObject({
      code: "invalid",
      fieldErrors: { target_date: [expect.stringMatching(/tomorrow/)] },
    });
  });

  it("Given goal weight 76 kg and 14 % with no date, Then it becomes the active goal", async () => {
    const goal = await setGoal(u.client, profile, { unit: "kg", goal_weight: "76", goal_body_fat_pct: "14", target_date: "" }, NOW);
    expect(goal).toMatchObject({ status: "active", target_date: null });
    expect(Number(goal.goal_weight_kg)).toBe(76);
    expect((await getActiveGoal(u.client))?.id).toBe(goal.id);
  });

  it("Given an active goal, When a new one is saved, Then the previous one is archived in history", async () => {
    const previous = await getActiveGoal(u.client);
    const next = await setGoal(u.client, profile, { unit: "lb", goal_weight: "167.6", target_date: "2026-12-06" }, NOW);
    expect(Number(next.goal_weight_kg)).toBe(76.02);
    const history = await listGoalHistory(u.client);
    expect(history.find((g) => g.id === previous!.id)).toMatchObject({ status: "archived", archived_at: expect.any(String) });
    expect(history.filter((g) => g.status === "active")).toHaveLength(1);
  });
});

describe("getGoalState", () => {
  it("Given no active goal, Then no phase and no rate", async () => {
    expect(await getGoalState(fresh.client, freshProfile, TODAY)).toEqual({ state: null, reason: "no_goal" });
  });

  it("Given a goal but no weight, Then no phase with a reason", async () => {
    await setGoal(fresh.client, freshProfile, { unit: "kg", goal_weight: 70 }, NOW);
    expect(await getGoalState(fresh.client, freshProfile, TODAY)).toEqual({ state: null, reason: "needs_weight" });
  });

  it("Given a cut from trend 80 kg to 76 kg with no date, Then phase cut at −0.40 kg/week", async () => {
    await setGoal(u.client, profile, { unit: "kg", goal_weight: 76 }, NOW);
    const result = await getGoalState(u.client, profile, TODAY);
    expect(result.state).toMatchObject({ phase: "cut", goalWeightKg: 76 });
    expect(result.state!.targetRateKgPerWeek).toBeCloseTo(-0.4, 6);
  });

  it("Given only a body fat goal and a body composition test, Then the implied weight drives the phase", async () => {
    await u.client.from("body_composition_tests").insert({
      occurred_at: "2026-10-01T00:00:00Z",
      local_date: "2026-10-01",
      method: "dexa",
      weight_kg: 80,
      body_fat_pct: 20,
      lean_mass_kg: 64,
      fat_mass_kg: 16,
    });
    await setGoal(u.client, profile, { unit: "kg", goal_body_fat_pct: 15 }, NOW);
    const result = await getGoalState(u.client, profile, TODAY);
    expect(result.state?.phase).toBe("cut");
    expect(result.state?.goalWeightKg).toBeCloseTo(75.29, 2);
  });
});
