import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  const token = await adminClient()
    .from("ingest_tokens")
    .insert({ user_id: a.id, token_hash: "0".repeat(64), prefix: "ha_abcde", last4: "wxyz" })
    .select("id")
    .single();
  if (token.error) throw token.error;
  const rate = await adminClient().from("ingest_rate").insert({ token_id: token.data.id, window_start: new Date().toISOString(), count: 1 });
  if (rate.error) throw rate.error;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("ingest secrets", () => {
  it.each(["ingest_tokens", "ingest_rate"] as const)("Given A has a token, When any client selects %s, Then zero rows are returned", async (table) => {
    for (const client of [a.client, b.client, anonClient()]) {
      const { data } = await client.from(table).select("*");
      expect(data ?? []).toEqual([]);
    }
  });

  it("When an authenticated user calls ingest_health via RPC, Then permission is denied", async () => {
    const { error } = await a.client.rpc("ingest_health", { p_user_id: b.id, p_payload: { daily: [{ date: "2026-06-14", steps: 1 }] } });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect((await adminClient().from("daily_metrics").select("id").eq("user_id", b.id)).data).toEqual([]);
  });
});
