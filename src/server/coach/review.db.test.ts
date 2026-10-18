import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { MissingAiKeyError } from "@/server/ai/client";
import type { StructuredClient } from "@/server/ai/structured";
import type { Profile } from "@/server/auth";
import { loadWeeklyReview, summarizeWeek } from "./review";

const WEEK = "2026-10-19";
let user: TestUser;
let profile: Profile;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
  profile = (await user.client.from("profiles").select("*").single()).data!;
  const { data: plan } = await user.client.from("training_plans").insert({ local_date: "2026-10-18", week_start: WEEK, phase: "base", context_snapshot: {} }).select("id").single();
  await user.client.rpc("accept_training_plan", { p_plan_id: plan!.id });
  const inserted = await user.client.from("planned_sessions").insert([
    { plan_id: plan!.id, local_date: "2026-10-20", day_index: 1, type: "run", details: { type: "run", distance_km: 6 }, status: "completed" },
    { plan_id: plan!.id, local_date: "2026-10-22", day_index: 3, type: "strength", details: { type: "strength" }, status: "skipped" },
    { plan_id: plan!.id, local_date: "2026-10-25", day_index: 6, type: "rest", details: { type: "rest" }, status: "planned" },
  ]);
  if (inserted.error) throw inserted.error;
  await user.client.from("activities").insert({ occurred_at: "2026-10-20T06:00:00Z", local_date: "2026-10-20", sport: "running", distance_m: 6100 });
});
afterAll(() => deleteTestUser(user));

describe("weekly review", () => {
  it("computes figures from the week's active plan and recorded runs", async () => {
    const review = await loadWeeklyReview(user.client, profile, WEEK);
    expect(review).toMatchObject({ plannedSessions: 2, completedSessions: 1, skippedSessions: 1, adherencePct: 50, runKm: 6.1, plannedRunKm: 6 });
  });

  it("sends only the computed figures to the model", async () => {
    const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: { summary: "Solid week." } }));
    const client = { beta: { messages: { parse } } } as unknown as StructuredClient;
    const result = await summarizeWeek(user.client, profile, WEEK, (call) => call(client));
    expect(result.summary).toBe("Solid week.");
    const sent = JSON.stringify((parse.mock.calls[0] as unknown[])[0]);
    expect(sent).toMatch(/1 of 2 planned completed \(50%\)/);
    expect(sent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("Given no AI key, Then an explanatory error is returned and no call is made", async () => {
    const parse = vi.fn();
    const runAi = async () => {
      throw new MissingAiKeyError();
    };
    await expect(summarizeWeek(user.client, profile, WEEK, runAi)).rejects.toMatchObject({ code: "missing_ai_key", message: expect.stringMatching(/Settings/) });
    expect(parse).not.toHaveBeenCalled();
  });
});
