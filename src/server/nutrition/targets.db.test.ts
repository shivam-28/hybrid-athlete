import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { Profile } from "@/server/auth";
import { getTargetsForDate, loadTargetInputs, setLogDayComplete } from "./targets";

// "Now" is 14:00 in Copenhagen on 18 October 2026.
const NOW = new Date("2026-10-18T12:00:00Z");
const TODAY = "2026-10-18";
const YESTERDAY = "2026-10-17";

let u: TestUser;
let profile: Profile;

async function reloadProfile() {
  profile = (await u.client.from("profiles").select("*").single()).data!;
}

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  await reloadProfile();
  const weights = ["2026-10-10", "2026-10-12", "2026-10-14", "2026-10-16"].map((d) => ({
    occurred_at: `${d}T05:00:00Z`,
    local_date: d,
    weight_kg: 80,
  }));
  await u.client.from("body_weights").insert(weights);
  await u.client.from("activities").insert({
    occurred_at: "2026-10-18T05:00:00Z",
    local_date: TODAY,
    sport: "running",
    elapsed_s: 3600,
    moving_s: 3600,
    distance_m: 10000,
    calories_kcal: 850,
    sources: ["fit"],
  });
});

afterAll(() => deleteTestUser(u));

describe("loadTargetInputs", () => {
  it("assembles profile, trend weight, activities and window stats for a day", async () => {
    const inputs = await loadTargetInputs(u.client, profile, TODAY, NOW);
    expect(inputs.trendWeightKg).toBeCloseTo(80, 6);
    expect(inputs.profile).toEqual({ sex: "male", birthDate: "1995-06-01", heightCm: 180, lifestyle: "sedentary" });
    expect(inputs.activities).toHaveLength(1);
    expect(inputs.activities[0]).toMatchObject({ sport: "running", durationS: 3600, activeKcal: 850 });
    expect(inputs.goal).toBeNull();
    expect(inputs.adaptive.completeDays).toBe(0);
  });

  it("Given the seeded user, Then today's targets are 2980 kcal (Mifflin 1775 × 1.2 + 850 run)", async () => {
    const r = await getTargetsForDate(u.client, profile, TODAY, NOW);
    expect(r.result.ok && r.result.targets.kcal).toBe(2980);
    expect(r.frozen).toBe(false);
  });
});

describe("target persistence", () => {
  it("Given today's targets were read, When a strength session is logged, Then the next read recomputes them", async () => {
    const before = await getTargetsForDate(u.client, profile, TODAY, NOW);
    await u.client.from("workout_sessions").insert({
      occurred_at: "2026-10-18T10:00:00Z",
      local_date: TODAY,
      finished_at: "2026-10-18T11:00:00Z",
    });
    const after = await getTargetsForDate(u.client, profile, TODAY, NOW);
    expect(after.result.ok && before.result.ok && after.result.targets.kcal - before.result.targets.kcal).toBe(400);
  });

  it("Given yesterday's targets were stored, When the goal changes today, Then yesterday's targets are unchanged", async () => {
    const before = await getTargetsForDate(u.client, profile, YESTERDAY, NOW);
    expect(before.frozen).toBe(true);
    await u.client.from("body_goals").insert({ occurred_at: NOW.toISOString(), local_date: TODAY, goal_weight_kg: 74 });
    const after = await getTargetsForDate(u.client, profile, YESTERDAY, NOW);
    expect(after.result).toEqual(before.result);
    const today = await getTargetsForDate(u.client, profile, TODAY, NOW);
    expect(today.result.ok && today.result.info.phase).toBe("cut");
  });

  it("Given a past day with no stored row, Then it is computed once and then frozen", async () => {
    const day = "2026-10-15";
    const first = await getTargetsForDate(u.client, profile, day, NOW);
    await u.client.from("profiles").update({ lifestyle_level: "active" }).eq("user_id", u.id);
    await reloadProfile();
    const second = await getTargetsForDate(u.client, profile, day, NOW);
    expect(second.result).toEqual(first.result);
    const { count } = await u.client.from("daily_nutrition_targets").select("id", { count: "exact", head: true }).eq("local_date", day);
    expect(count).toBe(1);
  });

  it("Given the lifestyle changed to active, Then today's targets use 1.5", async () => {
    const today = await getTargetsForDate(u.client, profile, TODAY, NOW);
    expect(today.result.ok && today.result.info.neatFactor).toBe(1.5);
  });
});

describe("food log completeness", () => {
  it("toggles a day's completeness", async () => {
    await setLogDayComplete(u.client, YESTERDAY, true);
    expect((await u.client.from("food_log_days").select("is_complete").eq("local_date", YESTERDAY).single()).data?.is_complete).toBe(true);
    await setLogDayComplete(u.client, YESTERDAY, false);
    expect((await u.client.from("food_log_days").select("is_complete").eq("local_date", YESTERDAY).single()).data?.is_complete).toBe(false);
  });

  it("counts complete days and their intake in the adaptive window", async () => {
    const { data: meal } = await u.client
      .from("meals")
      .insert({ occurred_at: "2026-10-16T11:00:00Z", local_date: "2026-10-16", meal_type: "lunch", source: "search" })
      .select("id")
      .single();
    await u.client.from("meal_items").insert({
      meal_id: meal!.id,
      position: 0,
      name: "Big lunch",
      grams: 500,
      quantity_source: "user",
      nutrient_source: "estimated",
      per100g: {},
      kcal: 2400,
      protein_g: 100,
      carb_g: 300,
      fat_g: 80,
    });
    await setLogDayComplete(u.client, "2026-10-16", true);
    const inputs = await loadTargetInputs(u.client, profile, TODAY, NOW);
    expect(inputs.adaptive.completeDays).toBe(1);
    expect(inputs.adaptive.meanIntakeKcal).toBe(2400);
    expect(inputs.adaptive.weighIns).toBe(4);
  });
});
