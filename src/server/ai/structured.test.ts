import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AI_MODELS, AiRefusalError, registerAiMeta } from "./client";
import { parseStructured, type StructuredClient } from "./structured";

const schema = z.object({ ok: z.boolean() });

function fakeClient(response: { stop_reason: string; parsed_output: unknown }) {
  const parse = vi.fn<(body: unknown) => Promise<typeof response>>(async () => response);
  return { client: { beta: { messages: { parse } } } as unknown as StructuredClient, parse };
}
const request = { system: "s", content: [{ type: "text" as const, text: "x" }], schema, maxTokens: 100 };

describe("parseStructured", () => {
  it("Given an Anthropic client, Then it requests server-side fallbacks on the main model", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: { ok: true } });
    expect(await parseStructured(client, request)).toEqual({ ok: true });
    expect(parse.mock.calls[0]![0]).toMatchObject({ model: AI_MODELS.main, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });

  it("Given a Foundry client, Then it omits betas/fallbacks and uses the user's main deployment", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: { ok: true } });
    registerAiMeta(client, { provider: "foundry", models: { main: "opus-prod", fast: "haiku-prod" } });
    await parseStructured(client, request);
    const body = parse.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.model).toBe("opus-prod");
    expect(body).not.toHaveProperty("betas");
    expect(body).not.toHaveProperty("fallbacks");
  });

  it("Given a refusal, Then it throws AiRefusalError", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(parseStructured(client, request)).rejects.toBeInstanceOf(AiRefusalError);
  });

  it("Given unparsable output, Then it returns null", async () => {
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: null });
    expect(await parseStructured(client, request)).toBeNull();
  });
});
