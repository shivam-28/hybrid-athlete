import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import type { Profile } from "@/server/auth";
import { chooseAdjustment, loadTodayCoach, submitCheckin } from "./readiness";

// Readiness must never need the AI client (spec: works without a key).
vi.mock("@/server/ai/client", async (original) => ({
  ...(await original<typeof import("@/server/ai/client")>()),
  getAnthropicClient: vi.fn(() => {
    throw new Error("AI client must not be used for readiness");
  }),
}));

const NOW = new Date("2026-10-20T05:00:00Z"); // Tuesday 07:00 Copenhagen
let user: TestUser;
let profile: Profile;
let intervalsId: string;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
  profile = (await user.client.from("profiles").select("*").single()).data!;
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
      local_date: "2026-10-20",
      day_index: 1,
      type: "run",
      details: { type: "run", title: "6 × 800 m", run_type: "intervals", duration_min: 45, distance_km: null, hr_zone: 4, pace: null, notes: null },
    })
    .select("id")
    .single();
  intervalsId = data!.id;
});
afterAll(() => deleteTestUser(user));

describe("readiness without an AI key", () => {
  it("Given no wearable data and 4, 4, 4, 4, Then readiness is green with signals unavailable", async () => {
    const coach = await submitCheckin(user.client, profile, { sleep_quality: 4, soreness: 4, energy: 4, stress: 4 }, NOW);
    expect(coach.readiness?.score).toBe("green");
    expect(coach.readiness?.signals.every((s) => s.status === "unavailable")).toBe(true);
    expect(coach.sessions[0]!.proposed).toBeNull();
  });

  it("Given a resubmission on the same day, Then it replaces the check-in and recomputes readiness", async () => {
    const coach = await submitCheckin(user.client, profile, { sleep_quality: 3, soreness: 3, energy: 3, stress: 2 }, NOW);
    expect(coach.readiness?.score).toBe("amber");
    expect((await user.client.from("readiness_checkins").select("id")).data).toHaveLength(1);
    expect(coach.sessions[0]!.proposed).toMatchObject({ run_type: "easy", duration_min: 45 });
  });

  it("Given amber, When the user accepts the adjustment, Then the session carries the easy run and the choice is recorded", async () => {
    await chooseAdjustment(user.client, profile, "accepted", NOW);
    const { data } = await user.client.from("planned_sessions").select("adjusted_details").eq("id", intervalsId).single();
    expect(data!.adjusted_details).toMatchObject({ run_type: "easy" });
    expect((await user.client.from("readiness_checkins").select("adjustment_choice").single()).data!.adjustment_choice).toBe("accepted");
  });

  it("Given amber, When the user keeps the original, Then the original stays active and the override is recorded", async () => {
    const coach = await chooseAdjustment(user.client, profile, "overridden", NOW);
    expect(coach.sessions[0]!.session.adjusted_details).toBeNull();
    expect(coach.checkin!.adjustment_choice).toBe("overridden");
  });

  it("rejects out-of-range answers", async () => {
    await expect(submitCheckin(user.client, profile, { sleep_quality: 0, soreness: 3, energy: 3, stress: 3 }, NOW)).rejects.toMatchObject({ code: "invalid" });
  });

  it("Given the pain flag, Then readiness is red with a professional referral", async () => {
    const coach = await submitCheckin(user.client, profile, { sleep_quality: 5, soreness: 5, energy: 5, stress: 5, pain_flag: true, pain_note: "knee" }, NOW);
    expect(coach.readiness?.score).toBe("red");
    expect(coach.readiness?.referral).toMatch(/qualified professional/);
    expect(coach.sessions[0]!.proposed).toMatchObject({ type: "mobility" });
  });

  it("loads today's state without a check-in for a new day", async () => {
    const coach = await loadTodayCoach(user.client, profile, new Date("2026-10-21T05:00:00Z"));
    expect(coach.checkin).toBeNull();
    expect(coach.readiness).toBeNull();
  });
});
