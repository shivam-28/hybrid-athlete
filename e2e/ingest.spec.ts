import { expect, test } from "@playwright/test";

test("Given no session, When the ingest schema is fetched, Then it is served without a sign-in redirect", async ({ request }) => {
  const res = await request.get("/api/ingest/health/schema", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(JSON.stringify(await res.json())).toContain("workouts");
});

test("Given no token, When posting to the ingest endpoint, Then the endpoint itself answers 401 (no proxy redirect)", async ({ request }) => {
  const res = await request.post("/api/ingest/health", { data: {}, maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect((await res.json()).message).toMatch(/ingest token/i);
});
