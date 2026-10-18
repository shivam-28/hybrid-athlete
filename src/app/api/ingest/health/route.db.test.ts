import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../../../tests/supabase-test-helpers";
import { generateIngestToken, revokeIngestToken } from "@/server/ingest/tokens";
import { POST } from "./route";

let a: TestUser;
let b: TestUser;
let tokenA: string;

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/ingest/health", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const valid = {
  daily: [{ date: "2026-06-14", steps: 9000 }],
  workouts: [{ sport: "running", start: "2026-06-14T07:00:00+02:00", end: "2026-06-14T07:50:00+02:00", duration_s: 3000, distance_m: 10000, avg_hr: 150 }],
};
const rows = async (userId: string) => ({
  daily: (await adminClient().from("daily_metrics").select("id").eq("user_id", userId)).data!.length,
  activities: (await adminClient().from("activities").select("id").eq("user_id", userId)).data!.length,
});

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert({ ...sampleProfile, birth_date: "1996-01-01" });
  tokenA = await generateIngestToken(a.id);
});
afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("POST /api/ingest/health", () => {
  it.each([
    ["no Authorization header", {}],
    ["an unknown token", bearer(`ha_${"A".repeat(43)}`)],
    ["a session cookie only", { cookie: "sb-127-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0" }],
  ])("Given %s, Then 401 and nothing is stored", async (_, headers) => {
    const res = await post(valid, headers);
    expect(res.status).toBe(401);
    expect(await rows(a.id)).toEqual({ daily: 0, activities: 0 });
  });

  it("Given a payload with a user_id field, Then 400", async () => {
    const res = await post({ ...valid, user_id: b.id }, bearer(tokenA));
    expect(res.status).toBe(400);
    expect(await rows(b.id)).toEqual({ daily: 0, activities: 0 });
  });

  it("Given a body over 1 MB, Then 413 and nothing is stored", async () => {
    const big = JSON.stringify({ daily: [{ date: "2026-06-14", steps: 1 }], padding: "x".repeat(1_100_000) });
    expect((await post(big, bearer(tokenA))).status).toBe(413);
    expect((await post(big, { ...bearer(tokenA), "content-length": "100" })).status).toBe(413);
    expect(await rows(a.id)).toEqual({ daily: 0, activities: 0 });
  });

  it("Given an invalid payload, Then 400 with field issues and nothing is stored", async () => {
    const res = await post({ workouts: [...valid.workouts, { ...valid.workouts[0], end: "2026-06-14T06:00:00+02:00" }] }, bearer(tokenA));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.map((i: { path: string }) => i.path)).toContain("workouts.1.end");
    expect(await rows(a.id)).toEqual({ daily: 0, activities: 0 });
  });

  it("Given a valid payload, Then 200 with counts, data owned by the token user, and the sync recorded", async () => {
    const res = await post(valid, bearer(tokenA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(await rows(a.id)).toEqual({ daily: 1, activities: 1 });
    expect(await rows(b.id)).toEqual({ daily: 0, activities: 0 });

    const { data: act } = await adminClient().from("activities").select("load, max_hr_used, max_hr_source").eq("user_id", a.id).single();
    // age 30 → max HR 187; avg 150 = 80.2 % → zone 4; 50 min × 4 = 200
    expect(act).toEqual({ load: 200, max_hr_used: 187, max_hr_source: "estimated" });

    const { data: token } = await adminClient().from("ingest_tokens").select("last_used_at, last_result").eq("user_id", a.id).is("revoked_at", null).single();
    expect(token?.last_used_at).not.toBeNull();
    expect(token?.last_result).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
  });

  it("Given a revoked token, Then 401", async () => {
    const revoked = await generateIngestToken(b.id);
    await revokeIngestToken(b.id);
    expect((await post(valid, bearer(revoked))).status).toBe(401);
  });

  it("Given 30 requests in the hour, When the 31st arrives, Then 429 with Retry-After", async () => {
    const token = await generateIngestToken(b.id);
    for (let i = 0; i < 30; i++) expect((await post({}, bearer(token))).status).toBe(200);
    const res = await post({}, bearer(token));
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });
});
