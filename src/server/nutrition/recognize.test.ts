import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import usda from "../../../tests/fixtures/nutrition/usda-rice.json";
import { MissingAiKeyError } from "@/server/ai/client";
import type { StructuredClient } from "@/server/ai/structured";
import { NutritionError } from "./errors";
import type { LookupCache, MatcherDeps } from "./matcher";
import { recognizeMeal, recognizeForUser, type RawMealItem } from "./recognize";
import { refusingAi } from "../../../tests/ai-test-helpers";

const per100 = { kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, satfat_g: 1, sodium_mg: 74 };
const item = (patch: Partial<RawMealItem> = {}): RawMealItem => ({
  name: "Chicken breast",
  search_query: "chicken breast grilled",
  grams: 150,
  preparation: "grilled",
  confidence: "high",
  quantity_source: "estimated",
  packaged: false,
  per100g: per100,
  ...patch,
});

function mockClient(...outputs: (unknown | Error)[]) {
  const parse = vi.fn(async () => {
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return { stop_reason: "end_turn", parsed_output: next ?? null };
  });
  return { client: { beta: { messages: { parse } } } as unknown as StructuredClient, parse };
}

const noCache: LookupCache = { get: async () => null, set: async () => undefined };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const deps = (usdaBody: unknown = { foods: [] }): MatcherDeps => ({
  fetch: (async (url: RequestInfo | URL) => (String(url).includes("usda") ? json(usdaBody) : json({ products: [] }))) as typeof fetch,
  usdaKey: "K",
  cache: noCache,
});

describe("recognizeMeal", () => {
  it("Given a photo of chicken, rice and salad, Then a draft lists three items with grams, preparation, confidence and matches", async () => {
    const { client, parse } = mockClient({
      contains_food: true,
      meal_name: "Chicken, rice and salad",
      items: [item(), item({ name: "White rice", search_query: "cooked white rice", grams: 180, confidence: "medium" }), item({ name: "Side salad", search_query: "green salad", grams: 80, confidence: "low" })],
    });
    const r = await recognizeMeal(client, { imageBase64: "AAAA" }, deps(usda));
    expect(r.kind).toBe("draft");
    if (r.kind !== "draft") return;
    expect(r.draft.items.map((i) => [i.name, i.grams, i.confidence])).toEqual([
      ["Chicken breast", 150, "high"],
      ["White rice", 180, "medium"],
      ["Side salad", 80, "low"],
    ]);
    expect(r.draft.items[1]!.nutrient_source).toBe("usda");
    expect(r.draft.items[1]!.estimate).not.toBeNull();
    const [body] = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    expect(JSON.stringify(body.messages)).toContain('"type":"image"');
  });

  it("Given invalid output once, Then it retries and succeeds", async () => {
    const { client, parse } = mockClient(null, { contains_food: true, meal_name: null, items: [item()] });
    const r = await recognizeMeal(client, { description: "chicken" }, deps());
    expect(r.kind).toBe("draft");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("Given implausible values twice, Then it gives up as unreadable", async () => {
    const { client, parse } = mockClient(
      { contains_food: true, meal_name: null, items: [item({ grams: -5 })] },
      { contains_food: true, meal_name: null, items: [item({ per100g: { ...per100, kcal: 5000 } })] },
    );
    expect((await recognizeMeal(client, { imageBase64: "AAAA" }, deps())).kind).toBe("unreadable");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("Given an SDK output-parsing error, Then it counts as invalid output (retry), not an outage", async () => {
    const { client } = mockClient(new Anthropic.AnthropicError("Failed to parse structured output"), { contains_food: true, meal_name: null, items: [item()] });
    expect((await recognizeMeal(client, { imageBase64: "AAAA" }, deps())).kind).toBe("draft");
  });

  it("Given a photo with no food, Then it reports no food found", async () => {
    const { client } = mockClient({ contains_food: false, meal_name: null, items: [] });
    expect(await recognizeMeal(client, { imageBase64: "AAAA" }, deps())).toEqual({ kind: "no_food" });
  });

  it("Given '200 g chicken breast with rice and a side salad', Then chicken is user-stated and the rest estimated", async () => {
    const { client } = mockClient({
      contains_food: true,
      meal_name: null,
      items: [
        item({ grams: 200, quantity_source: "user" }),
        item({ name: "Rice", grams: 150, quantity_source: "user" }),
        item({ name: "Side salad", grams: 80, quantity_source: "estimated" }),
      ],
    });
    const r = await recognizeMeal(client, { description: "200 g chicken breast with rice and a side salad" }, deps());
    if (r.kind !== "draft") throw new Error("expected draft");
    // The model claimed rice was user-stated, but "150" never appears in the text.
    expect(r.draft.items.map((i) => i.quantity_source)).toEqual(["user", "estimated", "estimated"]);
    expect(r.draft.source).toBe("text");
  });
});

describe("recognizeForUser", () => {
  it("Given no stored AI key, Then a 409 missing_ai_key error is raised", async () => {
    const runAi = async () => {
      throw new MissingAiKeyError();
    };
    await expect(recognizeForUser(null as never, "u1", { description: "toast" }, runAi, deps())).rejects.toMatchObject({
      code: "missing_ai_key",
    });
    await expect(recognizeForUser(null as never, "u1", { description: "toast" }, runAi, deps())).rejects.toBeInstanceOf(NutritionError);
  });

  it("Given an Anthropic outage, Then ai_unavailable is raised", async () => {
    const runAi = async () => {
      throw Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error" } }, "overloaded", new Headers());
    };
    await expect(recognizeForUser(null as never, "u1", { description: "toast" }, runAi, deps())).rejects.toMatchObject({ code: "ai_unavailable" });
  });

  it("rejects a photo path outside the user's folder", async () => {
    await expect(recognizeForUser(null as never, "u1", { photoPath: "u2/x.jpg" }, async () => null as never, deps())).rejects.toMatchObject({
      code: "invalid",
    });
  });
});

describe("declined requests", () => {
  it("Given Claude declines a meal photo, Then ai_declined is raised and no retry runs", async () => {
    const { run, parse } = refusingAi();
    await expect(recognizeForUser(null as never, "u1", { description: "toast" }, run, deps())).rejects.toMatchObject({
      code: "ai_declined",
      message: expect.stringMatching(/declined/i),
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
