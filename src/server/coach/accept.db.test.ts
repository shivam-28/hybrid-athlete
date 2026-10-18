import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let user: TestUser;

async function draft(week: string, warnings: unknown[] = []) {
  const { data, error } = await user.client
    .from("training_plans")
    .insert({ local_date: "2026-10-18", week_start: week, phase: "base", context_snapshot: {}, warnings: warnings as never })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
});
afterAll(() => deleteTestUser(user));

describe("accept_training_plan", () => {
  it("Given an active plan for a week, When a second plan is accepted, Then the first is superseded and both remain", async () => {
    const first = await draft("2026-10-19");
    const second = await draft("2026-10-19");
    expect((await user.client.rpc("accept_training_plan", { p_plan_id: first })).error).toBeNull();
    expect((await user.client.rpc("accept_training_plan", { p_plan_id: second })).error).toBeNull();

    const { data } = await user.client.from("training_plans").select("id, status").eq("week_start", "2026-10-19");
    const byId = Object.fromEntries((data ?? []).map((p) => [p.id, p.status]));
    expect(byId[first]).toBe("superseded");
    expect(byId[second]).toBe("active");
    expect((data ?? []).filter((p) => p.status === "active")).toHaveLength(1);
  });

  it("Given a plan with unacknowledged warnings, When accepted, Then it is refused", async () => {
    const id = await draft("2026-10-26", [{ rule: "rest_day", message: "No rest day" }]);
    expect((await user.client.rpc("accept_training_plan", { p_plan_id: id })).error).not.toBeNull();
    await user.client.from("training_plans").update({ acknowledged_warnings: true }).eq("id", id);
    expect((await user.client.rpc("accept_training_plan", { p_plan_id: id })).error).toBeNull();
  });

  it("Given a plan for a different week, Then accepting it leaves other weeks untouched", async () => {
    const other = await draft("2026-11-02");
    await user.client.rpc("accept_training_plan", { p_plan_id: other });
    const { data } = await user.client.from("training_plans").select("status").eq("week_start", "2026-10-19").eq("status", "active");
    expect(data).toHaveLength(1);
  });
});
