import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { extractFit, parseFit } from "@/lib/fit/parse";
import { isoWeekStart, localDate } from "@/lib/time";
import { POST as ingest } from "@/app/api/ingest/health/route";
import type { Profile } from "@/server/auth";
import { importFitUpload } from "@/server/activities/fit-import";
import { generateIngestToken } from "@/server/ingest/tokens";
import { addSet } from "@/server/workouts/sessions";

let user: TestUser;
let profile: Profile;

/** An active plan for the week containing `date`, with one session of `type` on that date. */
async function plannedOn(date: string, type: "run" | "strength") {
  const week = isoWeekStart(date);
  await user.client.from("training_plans").delete().eq("week_start", week);
  const { data: plan } = await user.client.from("training_plans").insert({ local_date: week, week_start: week, phase: "base", context_snapshot: {} }).select("id").single();
  await user.client.rpc("accept_training_plan", { p_plan_id: plan!.id });
  const dayIndex = Math.round((Date.parse(date) - Date.parse(week)) / 86_400_000);
  const { data } = await user.client.from("planned_sessions").insert({ plan_id: plan!.id, local_date: date, day_index: dayIndex, type, details: { type } }).select("id").single();
  return data!.id;
}
const status = async (id: string) => (await user.client.from("planned_sessions").select("status, activity_id, workout_session_id").eq("id", id).single()).data!;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert({ ...sampleProfile, max_hr_bpm: 190 });
  profile = (await user.client.from("profiles").select("*").single()).data!;
});
afterAll(() => deleteTestUser(user));

describe("auto-completion hooks", () => {
  it("Given a planned run, When the Apple Health ingest receives that day's run, Then it is completed", async () => {
    const p = await plannedOn("2026-10-20", "run");
    const token = await generateIngestToken(user.id);
    const res = await ingest(
      new Request("http://localhost/api/ingest/health", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workouts: [{ sport: "running", start: "2026-10-20T07:00:00+02:00", end: "2026-10-20T07:45:00+02:00", duration_s: 2700, distance_m: 7500 }] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await status(p)).toMatchObject({ status: "completed" });
  });

  it("Given a planned run, When a FIT run for that day is uploaded, Then it is completed", async () => {
    const bytes = new Uint8Array(readFileSync("tests/fixtures/fit/run-10k-hr.fit"));
    const day = localDate(parseFit(extractFit(bytes)).startedAt, profile.timezone);
    const p = await plannedOn(day, "run");
    const result = await importFitUpload(user.client, profile, bytes);
    expect(await status(p)).toMatchObject({ status: "completed", activity_id: result.activityId });
  });

  it("Given a planned strength session today, When the first set is logged, Then it is completed by that workout", async () => {
    const now = new Date();
    const today = localDate(now, profile.timezone);
    const p = await plannedOn(today, "strength");
    const { data: exercise } = await user.client.from("exercises").select("id").is("user_id", null).eq("tracking_mode", "weight_reps").limit(1).single();
    await addSet(user.client, profile, { exercise_id: exercise!.id, weight_kg: 20, reps: 10 }, now);
    const row = await status(p);
    expect(row.status).toBe("completed");
    expect(row.workout_session_id).not.toBeNull();
  });
});
