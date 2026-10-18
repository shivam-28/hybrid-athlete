import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { recomputeActivityZones } from "./activities";
import { importFitUpload } from "./fit-import";

let user: TestUser;
const profile = async (): Promise<Profile> => (await user.client.from("profiles").select("*").single()).data!;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert({ ...sampleProfile, birth_date: "1996-01-01" });
  await importFitUpload(user.client, await profile(), new Uint8Array(readFileSync("tests/fixtures/fit/run-5_4k.fit")));
  await adminClient().rpc("ingest_health", {
    p_user_id: user.id,
    p_payload: { workouts: [{ sport: "walking", start: "2026-06-20T08:00:00Z", end: "2026-06-20T08:30:00Z", duration_s: 1800, avg_hr: 120, load: 30, max_hr_used: 187, max_hr_source: "estimated" }] },
  });
});
afterAll(() => deleteTestUser(user));

describe("recomputeActivityZones", () => {
  it("Given max HR changes from estimated 187 to 150, Then zones and load of every activity are recomputed", async () => {
    const before = (await user.client.from("activities").select("sport, hr_zone_s, load, max_hr_used").order("occurred_at")).data!;
    expect(before[0]).toMatchObject({ sport: "running", max_hr_used: 187 });
    expect(before[0]!.hr_zone_s![2]).toBeGreaterThan(0); // 145/187 = 77.5 % → zone 3

    await user.client.from("profiles").update({ max_hr_bpm: 150 }).eq("user_id", user.id);
    await recomputeActivityZones(user.client, await profile());

    const after = (await user.client.from("activities").select("sport, hr_zone_s, load, max_hr_used, max_hr_source").order("occurred_at")).data!;
    // 145/150 = 96.7 % → zone 5 for the whole run: 31.5 min × 5
    expect(after[0]).toMatchObject({ max_hr_used: 150, max_hr_source: "profile", load: 157.5 });
    expect(after[0]!.hr_zone_s![4]).toBeGreaterThan(1800);
    expect(after[0]!.hr_zone_s![2]).toBe(0);
    // walk without a histogram: 120/150 = 80 % → zone 4: 30 min × 4
    expect(after[1]).toMatchObject({ max_hr_used: 150, load: 120, hr_zone_s: null });
  });
});
