import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteActivity } from "./activities";
import { importFitUpload } from "./fit-import";

let user: TestUser;
let profile: Profile;
const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/fit/${name}`));
const storedFiles = async () => (await adminClient().storage.from("activity-files").list(user.id)).data ?? [];
const activities = async () =>
  (await user.client.from("activities").select("id, sources, distance_m, fit_locked, fit_file_path, hr_zone_s, max_hr_used, max_hr_source, load").order("occurred_at")).data!;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert({ ...sampleProfile, birth_date: "1996-01-01", max_hr_bpm: 190 });
  profile = (await user.client.from("profiles").select("*").single()).data!;
});
afterAll(() => deleteTestUser(user));

describe("importFitUpload", () => {
  let runId: string;

  it("Given a valid FIT run, Then an activity with splits, zones and the stored original is created", async () => {
    const result = await importFitUpload(user.client, profile, fixture("run-5_4k.fit"));
    expect(result.status).toBe("created");
    runId = result.activityId;
    const [act] = await activities();
    expect(act).toMatchObject({ id: runId, sources: ["fit"], distance_m: 5400, fit_locked: true, max_hr_used: 190, max_hr_source: "profile" });
    // steady 145 bpm with max 190 → zone 3 (133–151) for the whole run
    expect(act!.hr_zone_s![2]).toBeGreaterThan(1800);
    expect(act!.load).toBeCloseTo(94.5, 0); // 31.5 min × 3
    const splits = (await user.client.from("activity_splits").select("idx, distance_m").eq("activity_id", runId).order("idx")).data!;
    expect(splits.map((s) => Number(s.distance_m))).toEqual([1000, 1000, 1000, 1000, 1000, 400]);
    expect((await storedFiles()).map((f) => f.name)).toEqual([`${runId}.fit`]);
  });

  it("Given the same file again, Then no duplicate is created and the existing activity is returned", async () => {
    const result = await importFitUpload(user.client, profile, fixture("garmin-export.zip"));
    expect(result).toEqual({ status: "duplicate", activityId: runId });
    expect(await activities()).toHaveLength(1);
    expect(await storedFiles()).toHaveLength(1);
  });

  it("Given a corrupt file, Then nothing is stored", async () => {
    await expect(importFitUpload(user.client, profile, fixture("corrupt.fit"))).rejects.toMatchObject({ code: "corrupt" });
    expect(await activities()).toHaveLength(1);
    expect(await storedFiles()).toHaveLength(1);
  });

  it("Given an Apple Health workout, When its FIT file is uploaded, Then one merged activity has both sources and FIT values", async () => {
    await adminClient().rpc("ingest_health", {
      p_user_id: user.id,
      p_payload: { workouts: [{ sport: "running", start: "2026-06-14T05:00:40Z", end: "2026-06-14T05:53:00Z", duration_s: 3100, distance_m: 9800 }] },
    });
    const result = await importFitUpload(user.client, profile, fixture("run-10k-hr.fit"));
    expect(result.status).toBe("merged");
    const merged = (await activities()).filter((a) => a.id === result.activityId);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ distance_m: 10000, fit_locked: true });
    expect(merged[0]!.sources.sort()).toEqual(["apple_health", "fit"]);
    expect(await activities()).toHaveLength(2);
  });

  it("Given the database rejects the import, Then the stored file is removed again", async () => {
    const failing = new Proxy(user.client, {
      get: (target, prop) =>
        prop === "rpc" ? async () => ({ data: null, error: { message: "boom", code: "XX000" } }) : Reflect.get(target, prop),
    });
    await expect(importFitUpload(failing, profile, fixture("run-no-hr.fit"))).rejects.toThrow();
    expect(await storedFiles()).toHaveLength(2);
  });

  it("Given an activity is deleted, Then its stored original file is deleted too", async () => {
    await deleteActivity(user.client, runId);
    expect((await activities()).map((a) => a.id)).not.toContain(runId);
    expect((await storedFiles()).map((f) => f.name)).not.toContain(`${runId}.fit`);
  });
});
