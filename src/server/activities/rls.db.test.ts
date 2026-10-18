import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;
let activityId: string;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  const act = await a.client
    .from("activities")
    .insert({ occurred_at: "2026-06-14T06:00:00Z", local_date: "2026-06-14", sport: "running", distance_m: 5000, moving_s: 1500, sources: ["fit"] })
    .select("id")
    .single();
  if (act.error) throw act.error;
  activityId = act.data.id;
  const split = await a.client.from("activity_splits").insert({ activity_id: activityId, idx: 0, distance_m: 1000, duration_s: 300 });
  if (split.error) throw split.error;
  const daily = await a.client
    .from("daily_metrics")
    .insert({ local_date: "2026-06-14", occurred_at: "2026-06-13T22:00:00Z", steps: 9000 });
  if (daily.error) throw daily.error;
  const up = await a.client.storage.from("activity-files").upload(`${a.id}/${activityId}.fit`, new Blob([new Uint8Array([1, 2, 3])]));
  if (up.error) throw up.error;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("activity data isolation", () => {
  it.each(["activities", "activity_splits", "daily_metrics"] as const)(
    "Given A has %s rows, When B selects them, Then nothing is returned",
    async (table) => {
      const { data, error } = await b.client.from(table).select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect((await a.client.from(table).select("*")).data?.length).toBeGreaterThan(0);
    },
  );

  it("When B updates or deletes A's activity, Then nothing changes", async () => {
    await b.client.from("activities").update({ distance_m: 1 }).eq("id", activityId);
    await b.client.from("activities").delete().eq("id", activityId);
    const { data } = await a.client.from("activities").select("distance_m").eq("id", activityId).single();
    expect(Number(data?.distance_m)).toBe(5000);
  });

  it("When B inserts an activity owned by A, Then the write is rejected", async () => {
    const { error } = await b.client
      .from("activities")
      .insert({ user_id: a.id, occurred_at: "2026-06-14T06:00:00Z", local_date: "2026-06-14", sport: "running" });
    expect(error).not.toBeNull();
  });

  it("When B reads A's stored FIT file, Then access is denied", async () => {
    const download = await b.client.storage.from("activity-files").download(`${a.id}/${activityId}.fit`);
    expect(download.data).toBeNull();
    const list = await b.client.storage.from("activity-files").list(a.id);
    expect(list.data ?? []).toEqual([]);
    const own = await a.client.storage.from("activity-files").download(`${a.id}/${activityId}.fit`);
    expect(own.data).not.toBeNull();
  });

  it("When B uploads into A's folder, Then it is rejected", async () => {
    const { error } = await b.client.storage.from("activity-files").upload(`${a.id}/evil.fit`, new Blob([new Uint8Array([1])]));
    expect(error).not.toBeNull();
  });

  it("rejects out-of-range daily metrics at the database level", async () => {
    const { error } = await a.client
      .from("daily_metrics")
      .insert({ local_date: "2026-06-15", occurred_at: "2026-06-14T22:00:00Z", resting_hr_bpm: 400 });
    expect(error).not.toBeNull();
  });
});
