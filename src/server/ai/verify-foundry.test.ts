import { describe, expect, it } from "vitest";
import { verifyFoundryKey } from "./verify-key";

const KEY = "FXOOtestkey0123456789abcdefABCDEF";
const input = { resource: "my-res", apiKey: KEY, mainDeployment: "opus-prod" };

function fakeFetch(status: number, seen?: { url?: string; key?: string | null; body?: Record<string, unknown> }) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.key = new Headers(init?.headers).get("x-api-key");
      seen.body = JSON.parse(String(init?.body));
    }
    const body = status === 200 ? { input_tokens: 3 } : { type: "error", error: { type: "x", message: "m" } };
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("verifyFoundryKey", () => {
  it("Given Foundry accepts the key and deployment, Then it is valid and only a token count was requested", async () => {
    const seen: { url?: string; key?: string | null; body?: Record<string, unknown> } = {};
    expect(await verifyFoundryKey(input, fakeFetch(200, seen))).toBe("valid");
    expect(seen.url).toBe("https://my-res.services.ai.azure.com/anthropic/v1/messages/count_tokens");
    expect(seen.key).toBe(KEY);
    expect(seen.body?.model).toBe("opus-prod");
  });

  it.each([401, 403])("Given Foundry returns %i, Then the key is rejected", async (status) => {
    expect(await verifyFoundryKey(input, fakeFetch(status))).toBe("rejected");
  });

  it("Given the main deployment does not exist (404), Then deployment_not_found", async () => {
    expect(await verifyFoundryKey(input, fakeFetch(404))).toBe("deployment_not_found");
  });

  it("Given a 500, Then unavailable", async () => {
    expect(await verifyFoundryKey(input, fakeFetch(500))).toBe("unavailable");
  });

  it("Given a network failure, Then unavailable", async () => {
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await verifyFoundryKey(input, boom)).toBe("unavailable");
  });

  it("Given a blank or whitespace key, Then rejected without calling Foundry", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    expect(await verifyFoundryKey({ ...input, apiKey: "  " }, spy)).toBe("rejected");
    expect(await verifyFoundryKey({ ...input, apiKey: "has space" }, spy)).toBe("rejected");
    expect(called).toBe(false);
  });
});
