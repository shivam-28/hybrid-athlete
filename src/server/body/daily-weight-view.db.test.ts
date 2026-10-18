import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let u: TestUser;

async function daily(date: string) {
  const { data } = await u.client.from("daily_body_weight").select("weight_kg, source").eq("local_date", date).maybeSingle();
  return data ? { weight_kg: Number(data.weight_kg), source: data.source } : null;
}

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  await u.client.from("daily_metrics").insert([
    { local_date: "2026-10-01", occurred_at: "2026-09-30T22:00:00Z", weight_kg: 78.9 },
    { local_date: "2026-10-02", occurred_at: "2026-10-01T22:00:00Z", weight_kg: 78.9 },
    { local_date: "2026-10-03", occurred_at: "2026-10-02T22:00:00Z", steps: 1000 },
  ]);
  await u.client.from("body_weights").insert([
    // 2026-10-01: Apple Health 78.9, manual 78.4 → manual wins
    { local_date: "2026-10-01", occurred_at: "2026-10-01T05:10:00Z", weight_kg: 78.4 },
    // 2026-10-03: two manual entries → earliest wins
    { local_date: "2026-10-03", occurred_at: "2026-10-03T19:00:00Z", weight_kg: 79.6 },
    { local_date: "2026-10-03", occurred_at: "2026-10-03T05:10:00Z", weight_kg: 78.4 },
  ]);
});

afterAll(() => deleteTestUser(u));

describe("daily_body_weight", () => {
  it("Given two manual entries on a day, Then the earliest wins", async () => {
    expect(await daily("2026-10-03")).toEqual({ weight_kg: 78.4, source: "manual" });
  });

  it("Given manual and Apple Health weights on a day, Then manual wins", async () => {
    expect(await daily("2026-10-01")).toEqual({ weight_kg: 78.4, source: "manual" });
  });

  it("Given only an Apple Health weight, Then it is used", async () => {
    expect(await daily("2026-10-02")).toEqual({ weight_kg: 78.9, source: "apple_health" });
  });

  it("Given daily metrics without a weight, Then the day has no Apple Health weight row", async () => {
    const { data } = await u.client.from("daily_body_weight").select("*").eq("local_date", "2026-10-03");
    expect(data).toHaveLength(1);
  });

  it("Given the only manual entry is deleted, Then the day falls back to Apple Health", async () => {
    await u.client.from("body_weights").delete().eq("local_date", "2026-10-01");
    expect(await daily("2026-10-01")).toEqual({ weight_kg: 78.9, source: "apple_health" });
  });

  it("returns one row per day ordered by date", async () => {
    const { data } = await u.client.from("daily_body_weight").select("local_date").order("local_date");
    expect(data?.map((r) => r.local_date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
});
