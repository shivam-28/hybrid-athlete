import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicClient, foundryClient } from "./providers";

const seen: { url: string; key: string | null; auth: string | null }[] = [];
const capture = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const h = new Headers(init?.headers);
  seen.push({ url: String(url), key: h.get("x-api-key"), auth: h.get("authorization") });
  return new Response(JSON.stringify({ input_tokens: 1, data: [], has_more: false }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  seen.length = 0;
});

describe("provider clients ignore operator environment", () => {
  it("Given operator Anthropic env vars, Then a user's Anthropic client still targets api.anthropic.com with only the user's key", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://operator.example/");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "operator-token");
    await anthropicClient("sk-ant-api03-user-key-123", { fetch: capture, maxRetries: 0 }).models.list({ limit: 1 });
    expect(seen[0]).toMatchObject({ key: "sk-ant-api03-user-key-123", auth: null });
    expect(seen[0]!.url.startsWith("https://api.anthropic.com/")).toBe(true);
  });

  it("Given operator Foundry env vars, Then a user's Foundry client targets the user's resource with only the user's key", async () => {
    vi.stubEnv("ANTHROPIC_FOUNDRY_BASE_URL", "https://operator.services.ai.azure.com/anthropic/");
    vi.stubEnv("ANTHROPIC_FOUNDRY_RESOURCE", "operator");
    vi.stubEnv("ANTHROPIC_FOUNDRY_API_KEY", "operator-key");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "operator-token");
    await foundryClient("user-res", "user-key", { fetch: capture, maxRetries: 0 }).messages.countTokens({
      model: "claude-opus-5-5",
      messages: [{ role: "user", content: "ping" }],
    });
    expect(seen[0]).toMatchObject({ url: "https://user-res.services.ai.azure.com/anthropic/v1/messages/count_tokens", key: "user-key", auth: null });
  });
});
