import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;
const ids: Record<string, string> = {};

async function insertOne(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table as never).insert(row as never).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  ids.training_preferences = await insertOne(a, "training_preferences", {
    days_per_week: 5,
    max_session_min: 75,
    long_run_weekday: 7,
    equipment: "gym",
  });
  ids.training_plans = await insertOne(a, "training_plans", {
    local_date: "2026-10-18",
    week_start: "2026-10-19",
    phase: "base",
    context_snapshot: {},
  });
  ids.planned_sessions = await insertOne(a, "planned_sessions", {
    plan_id: ids.training_plans,
    local_date: "2026-10-20",
    day_index: 1,
    type: "run",
    details: { type: "run", title: "Easy run", run_type: "easy", duration_min: 40 },
  });
  ids.readiness_checkins = await insertOne(a, "readiness_checkins", {
    local_date: "2026-10-18",
    occurred_at: "2026-10-18T06:00:00Z",
    sleep_quality: 4,
    soreness: 3,
    energy: 4,
    stress: 3,
    score: "green",
  });
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const TABLES = ["training_preferences", "training_plans", "planned_sessions", "readiness_checkins"] as const;

describe("coach data isolation", () => {
  it.each(TABLES)("Given A has %s rows, When B selects them, Then nothing is returned", async (table) => {
    const { data, error } = await b.client.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await a.client.from(table).select("*")).data?.length).toBe(1);
  });

  it.each(TABLES)("When B updates or deletes A's %s row, Then nothing changes", async (table) => {
    await b.client.from(table).update({ updated_at: "2020-01-01T00:00:00Z" }).eq("id", ids[table]!);
    await b.client.from(table).delete().eq("id", ids[table]!);
    const { data } = await a.client.from(table).select("updated_at").eq("id", ids[table]!).single();
    expect(data?.updated_at).not.toBe("2020-01-01T00:00:00+00:00");
  });

  it("When B inserts a planned session into A's plan, Then the write is rejected", async () => {
    const { error } = await b.client.from("planned_sessions").insert({
      plan_id: ids.training_plans!,
      local_date: "2026-10-21",
      day_index: 2,
      type: "rest",
      details: { type: "rest" },
    });
    expect(error).not.toBeNull();
  });

  it("When B requests A's plan by id, Then no data is returned", async () => {
    const { data } = await b.client.from("training_plans").select("*").eq("id", ids.training_plans!).maybeSingle();
    expect(data).toBeNull();
  });

  it("rejects out-of-range check-in values at the database level", async () => {
    const { error } = await a.client.from("readiness_checkins").insert({
      local_date: "2026-10-19",
      occurred_at: "2026-10-19T06:00:00Z",
      sleep_quality: 6,
      soreness: 3,
      energy: 4,
      stress: 3,
      score: "green",
    });
    expect(error).not.toBeNull();
  });

  it("allows only one check-in per user per local date", async () => {
    const { error } = await a.client.from("readiness_checkins").insert({
      local_date: "2026-10-18",
      occurred_at: "2026-10-18T09:00:00Z",
      sleep_quality: 2,
      soreness: 2,
      energy: 2,
      stress: 2,
      score: "amber",
    });
    expect(error).not.toBeNull();
  });
});
