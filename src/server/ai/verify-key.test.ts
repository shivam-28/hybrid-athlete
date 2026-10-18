import { describe, expect, it } from "vitest";
import { verifyAnthropicKey } from "./verify-key";

const respond = (status: number) => async () =>
  new Response(JSON.stringify(status === 200 ? { data: [], has_more: false } : { type: "error", error: { type: "x", message: "m" } }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("verifyAnthropicKey", () => {
  it("Given Anthropic accepts the key, Then it is valid", async () => {
    expect(await verifyAnthropicKey("sk-ant-api03-goodkey123", respond(200))).toBe("valid");
  });

  it.each([401, 403])("Given Anthropic returns %i, Then the key is rejected", async (status) => {
    expect(await verifyAnthropicKey("sk-ant-api03-badkey1234", respond(status))).toBe("rejected");
  });

  it("Given Anthropic returns 500, Then validation is unavailable", async () => {
    expect(await verifyAnthropicKey("sk-ant-api03-anykey1234", respond(500))).toBe("unavailable");
  });

  it("Given a network failure, Then validation is unavailable", async () => {
    const boom = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await verifyAnthropicKey("sk-ant-api03-anykey1234", boom)).toBe("unavailable");
  });

  it("Given an empty or malformed key, Then it is rejected without calling Anthropic", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return new Response("{}");
    };
    expect(await verifyAnthropicKey("  ", spy)).toBe("rejected");
    expect(await verifyAnthropicKey("not a key", spy)).toBe("rejected");
    expect(called).toBe(false);
  });
});
