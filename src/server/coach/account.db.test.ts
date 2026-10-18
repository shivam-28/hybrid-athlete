import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteAccount } from "../account/delete";
import { buildExport } from "../account/export";

const TABLES = ["training_preferences", "training_plans", "planned_sessions", "readiness_checkins"] as const;
let a: TestUser;
let b: TestUser;

async function seed(u: TestUser) {
  await u.client.from("profiles").insert(sampleProfile);
  await u.client.from("training_preferences").insert({ days_per_week: 4, max_session_min: 60, long_run_weekday: 7, equipment: "home" });
  const { data: plan } = await u.client
    .from("training_plans")
    .insert({ local_date: "2026-10-18", week_start: "2026-10-19", phase: "base", context_snapshot: {} })
    .select("id")
    .single();
  await u.client.from("planned_sessions").insert({ plan_id: plan!.id, local_date: "2026-10-19", day_index: 0, type: "rest", details: { type: "rest" } });
  await u.client
    .from("readiness_checkins")
    .insert({ local_date: "2026-10-18", sleep_quality: 4, soreness: 4, energy: 4, stress: 4, score: "green" });
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  await seed(a);
  await seed(b);
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("coach data in account export/delete", () => {
  it("Given A has coach data, When A exports, Then all four tables are included with only A's rows", async () => {
    const result = await buildExport(a.client, a.id);
    for (const table of TABLES) {
      expect(result.tables[table]).toHaveLength(1);
      expect(result.tables[table]!.every((r) => (r as { user_id: string }).user_id === a.id)).toBe(true);
    }
  });

  it("Given A deletes their account, Then no coach rows remain for A and B is untouched", async () => {
    await deleteAccount(a.id);
    const admin = adminClient();
    for (const table of TABLES) {
      expect((await admin.from(table).select("id").eq("user_id", a.id)).data).toEqual([]);
      expect((await admin.from(table).select("id").eq("user_id", b.id)).data).toHaveLength(1);
    }
  });
});
