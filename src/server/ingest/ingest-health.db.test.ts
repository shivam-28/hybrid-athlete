import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let user: TestUser;

const ingest = async (payload: unknown) => {
  const { data, error } = await adminClient().rpc("ingest_health", { p_user_id: user.id, p_payload: payload as never });
  if (error) throw error;
  return data as { inserted: number; updated: number; unchanged: number };
};

const count = async (table: "daily_metrics" | "activities") =>
  (await adminClient().from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id)).count;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
});
afterAll(() => deleteTestUser(user));

const run = {
  sport: "running",
  start: "2026-06-14T05:00:00Z",
  end: "2026-06-14T05:45:00Z",
  duration_s: 2700,
  distance_m: 8000,
  avg_hr: 145,
};

describe("ingest_health", () => {
  it("Given the same payload twice, Then the second post inserts nothing and row counts are stable", async () => {
    const payload = { daily: [{ date: "2026-06-14", steps: 8000, resting_hr_bpm: 52 }], workouts: [run] };
    expect(await ingest(payload)).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(await ingest(payload)).toEqual({ inserted: 0, updated: 0, unchanged: 2 });
    expect(await count("daily_metrics")).toBe(1);
    expect(await count("activities")).toBe(1);
  });

  it("Given a higher steps value for a stored date, Then it is replaced and counted as updated", async () => {
    expect(await ingest({ daily: [{ date: "2026-06-14", steps: 12000 }] })).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    const { data } = await adminClient().from("daily_metrics").select("steps, resting_hr_bpm").eq("user_id", user.id).single();
    expect(data).toEqual({ steps: 12000, resting_hr_bpm: 52 });
  });

  it("Given a partial daily entry, Then other stored metrics are kept, not nulled or zeroed", async () => {
    await ingest({ daily: [{ date: "2026-06-14", sleep_minutes: 420 }] });
    const { data } = await adminClient()
      .from("daily_metrics")
      .select("steps, resting_hr_bpm, sleep_minutes, hrv_sdnn_ms")
      .eq("user_id", user.id)
      .single();
    expect(data).toEqual({ steps: 12000, resting_hr_bpm: 52, sleep_minutes: 420, hrv_sdnn_ms: null });
  });

  it("stores a new date at local midnight in the profile timezone", async () => {
    await ingest({ daily: [{ date: "2026-06-15", steps: 100 }] });
    const { data } = await adminClient().from("daily_metrics").select("occurred_at").eq("user_id", user.id).eq("local_date", "2026-06-15").single();
    expect(new Date(data!.occurred_at).toISOString()).toBe("2026-06-14T22:00:00.000Z");
  });

  it("Given a workout starting 90 s after a stored one with the same sport, Then the stored workout is updated", async () => {
    const result = await ingest({ workouts: [{ ...run, start: "2026-06-14T05:01:30Z", end: "2026-06-14T05:46:30Z", distance_m: 8100 }] });
    expect(result).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(await count("activities")).toBe(2 - 1);
  });

  it("Given an external_id, Then later posts match it exactly even when the start time moved", async () => {
    const swim = { sport: "swimming", start: "2026-06-16T17:00:00Z", end: "2026-06-16T17:30:00Z", duration_s: 1800, external_id: "HK-123" };
    expect((await ingest({ workouts: [swim] })).inserted).toBe(1);
    expect(await ingest({ workouts: [{ ...swim, start: "2026-06-16T17:10:00Z", end: "2026-06-16T17:42:00Z", duration_s: 1920 }] })).toMatchObject({ inserted: 0, updated: 1 });
    expect((await adminClient().from("activities").select("id").eq("user_id", user.id).eq("sport", "swimming")).data).toHaveLength(1);
  });

  it("computes the workout's local date from the profile timezone", async () => {
    await ingest({ workouts: [{ ...run, sport: "walking", start: "2026-06-17T22:30:00Z", end: "2026-06-17T23:00:00Z", duration_s: 1800 }] });
    const { data } = await adminClient().from("activities").select("local_date").eq("user_id", user.id).eq("sport", "walking").single();
    expect(data?.local_date).toBe("2026-06-18");
  });

  it("Given a FIT-locked activity, When Apple Health posts it again, Then only empty fields are filled", async () => {
    const { data: fit } = await adminClient()
      .from("activities")
      .insert({
        user_id: user.id,
        occurred_at: "2026-06-20T06:00:00Z",
        local_date: "2026-06-20",
        sport: "cycling",
        distance_m: 30000,
        moving_s: 3600,
        avg_hr: 140,
        fit_locked: true,
        sources: ["fit"],
      })
      .select("id")
      .single();
    await ingest({
      workouts: [{ sport: "cycling", start: "2026-06-20T06:00:20Z", end: "2026-06-20T07:05:00Z", duration_s: 3900, distance_m: 29000, avg_hr: 150, active_energy_kcal: 700 }],
    });
    const { data } = await adminClient().from("activities").select("distance_m, moving_s, avg_hr, calories_kcal, sources").eq("id", fit!.id).single();
    expect(data).toEqual({ distance_m: 30000, moving_s: 3600, avg_hr: 140, calories_kcal: 700, sources: ["fit", "apple_health"] });
  });
});
