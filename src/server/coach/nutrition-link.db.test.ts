import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { Profile } from "@/server/auth";
import { getTargetsForDate } from "@/server/nutrition/targets";
import { setSessionStatus, syncPlannedCompletions } from "./completion";

const TODAY = "2026-10-25"; // Sunday
const MORNING = new Date("2026-10-25T06:00:00Z"); // 07:00 Copenhagen
let user: TestUser;
let profile: Profile;
let longRunId: string;

const targets = async () => {
  const t = await getTargetsForDate(user.client, profile, TODAY, MORNING);
  if (!t.result.ok) throw new Error("targets unavailable");
  return t.result;
};

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
  profile = (await user.client.from("profiles").select("*").single()).data!;
  await user.client.from("body_weights").insert({ occurred_at: "2026-10-25T05:30:00Z", local_date: TODAY, weight_kg: 80 });
  const { data: plan } = await user.client
    .from("training_plans")
    .insert({ local_date: "2026-10-18", week_start: "2026-10-19", phase: "base", context_snapshot: { history: { easyPaceMinPerKm: 6 } } })
    .select("id")
    .single();
  await user.client.rpc("accept_training_plan", { p_plan_id: plan!.id });
  const { data } = await user.client
    .from("planned_sessions")
    .insert({
      plan_id: plan!.id,
      local_date: TODAY,
      day_index: 6,
      type: "run",
      details: { type: "run", title: "Long run", run_type: "long", duration_min: null, distance_km: 18, hr_zone: 2, pace: null, notes: null },
    })
    .select("id")
    .single();
  longRunId = data!.id;
});
afterAll(() => deleteTestUser(user));

describe("planned session energy in nutrition targets", () => {
  it("Given an incomplete planned 18 km long run at 07:00, Then today's kcal and carbs already include it", async () => {
    const r = await targets();
    expect(r.components.find((c) => c.key === `planned:${longRunId}`)?.kcal).toBe(1440);
    expect(r.info.dayClass).toBe("long_run");
    expect(r.targets.carb_g).toBeGreaterThanOrEqual(480);
  });

  it("Given the run syncs with 1,150 kcal, Then the estimate is replaced by the recorded energy", async () => {
    await user.client.from("activities").insert({ occurred_at: "2026-10-25T08:00:00Z", local_date: TODAY, sport: "running", distance_m: 18000, moving_s: 6500, calories_kcal: 1150 });
    await syncPlannedCompletions(user.client, user.id, TODAY, TODAY);
    const r = await targets();
    expect(r.components.some((c) => c.key.startsWith("planned:"))).toBe(false);
    expect(r.info.exerciseKcal).toBe(1150);
  });

  it("Given the planned run is skipped, Then it contributes no exercise energy", async () => {
    await user.client.from("activities").delete().eq("local_date", TODAY);
    await setSessionStatus(user.client, longRunId, "skipped");
    const r = await targets();
    expect(r.info.exerciseKcal).toBe(0);
    expect(r.info.dayClass).toBe("rest");
  });
});
