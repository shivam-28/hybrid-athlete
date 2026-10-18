import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { setSessionStatus, syncPlannedCompletions } from "./completion";

const WEEK = "2026-10-19";
let user: TestUser;
let planId: string;

async function planned(day: number, type: string, status: "active" | "draft" = "active") {
  const plan = status === "active" ? planId : (await user.client.from("training_plans").insert({ local_date: WEEK, week_start: "2026-10-26", phase: "base", context_snapshot: {} }).select("id").single()).data!.id;
  const date = `2026-10-${19 + day}`;
  const { data } = await user.client.from("planned_sessions").insert({ plan_id: plan, local_date: date, day_index: day, type, details: { type } }).select("id").single();
  return data!.id;
}
async function run(date: string) {
  const { data } = await user.client.from("activities").insert({ occurred_at: `${date}T07:00:00Z`, local_date: date, sport: "running", distance_m: 8000, moving_s: 2880 }).select("id").single();
  return data!.id;
}
async function workout(date: string) {
  const { data } = await user.client.from("workout_sessions").insert({ occurred_at: `${date}T17:00:00Z`, local_date: date, finished_at: `${date}T18:00:00Z` }).select("id").single();
  return data!.id;
}
const row = async (id: string) => (await user.client.from("planned_sessions").select("*").eq("id", id).single()).data!;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
});
afterAll(() => deleteTestUser(user));
beforeEach(async () => {
  await user.client.from("training_plans").delete().neq("week_start", "1900-01-01");
  await user.client.from("activities").delete().neq("sport", "x");
  await user.client.from("workout_sessions").delete().neq("local_date", "1900-01-01");
  const { data } = await user.client.from("training_plans").insert({ local_date: WEEK, week_start: WEEK, phase: "base", context_snapshot: {}, status: "draft" }).select("id").single();
  planId = data!.id;
  await user.client.rpc("accept_training_plan", { p_plan_id: planId });
});

describe("syncPlannedCompletions", () => {
  it("Given a synced run on Tuesday, Then Tuesday's planned run is completed and linked", async () => {
    const p = await planned(1, "run");
    const a = await run("2026-10-20");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    expect(await row(p)).toMatchObject({ status: "completed", activity_id: a, auto_completed: true });
  });

  it("Given a workout on Thursday, Then Wednesday's strength session stays incomplete", async () => {
    const p = await planned(2, "strength");
    await workout("2026-10-22");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    expect(await row(p)).toMatchObject({ status: "planned", workout_session_id: null });
  });

  it("only completes sessions of the active plan, and is idempotent", async () => {
    const draftSession = await planned(1, "run", "draft");
    const active = await planned(1, "run");
    await run("2026-10-20");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    expect((await row(active)).status).toBe("completed");
    expect((await row(draftSession)).status).toBe("planned");
  });

  it("works with a service-role client when scoped to the user (ingest path)", async () => {
    const p = await planned(1, "run");
    await run("2026-10-20");
    await syncPlannedCompletions(adminClient(), user.id, "2026-10-19", "2026-10-25");
    expect((await row(p)).status).toBe("completed");
  });
});

describe("setSessionStatus", () => {
  it("Given the user skips today's tempo run, Then it is skipped and not auto-completed later", async () => {
    const p = await planned(1, "run");
    await setSessionStatus(user.client, p, "skipped");
    await run("2026-10-20");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    expect(await row(p)).toMatchObject({ status: "skipped", activity_id: null, manual: true });
  });

  it("Given an auto-completed session, When undone, Then it is planned again, unlinked and left alone", async () => {
    const p = await planned(1, "run");
    await run("2026-10-20");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    await setSessionStatus(user.client, p, "planned");
    await syncPlannedCompletions(user.client, user.id, "2026-10-19", "2026-10-25");
    expect(await row(p)).toMatchObject({ status: "planned", activity_id: null, auto_completed: false, manual: true });
  });

  it("Given the user marks a session complete by hand, Then it is completed without a link", async () => {
    const p = await planned(3, "mobility");
    await setSessionStatus(user.client, p, "completed");
    expect(await row(p)).toMatchObject({ status: "completed", manual: true, auto_completed: false });
  });
});
