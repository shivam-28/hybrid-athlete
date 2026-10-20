import { describe, expect, it, vi } from "vitest";
import type { StructuredClient } from "@/server/ai/structured";
import type { LookupCache, MatcherDeps } from "./matcher";
import { buildRecommendationContext, mapAiError, recommendMeals, type RawOptions, type RecommendationContext } from "./recommend";
import { AiRefusalError } from "@/server/ai/client";

const noCache: LookupCache = { get: async () => null, set: async () => undefined };
const offline: MatcherDeps = {
  fetch: (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch,
  usdaKey: undefined,
  cache: noCache,
};

function mockClient(...outputs: (RawOptions | null)[]) {
  const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: outputs.shift() ?? null }));
  return { client: { beta: { messages: { parse } } } as unknown as StructuredClient, parse };
}

const food = (name: string, grams: number, kcalPer100: number, protein = 10) => ({
  name,
  grams,
  search_query: name,
  per100g: { kcal: kcalPer100, protein_g: protein, carb_g: 10, fat_g: 3 },
});

const context = (patch: Partial<RecommendationContext> = {}): RecommendationContext => ({
  remaining: { kcal: 1100, protein_g: 60, carb_g: 120, fat_g: 30 },
  slots: ["snack", "dinner"],
  clock: "15:30",
  weightKg: 80,
  diet: "omnivore",
  allergies: [],
  dislikes: [],
  cuisines: [],
  runs: [],
  ...patch,
});

// 1100 kcal: snack 300 + dinner 800
const fitting = (title: string, dinner = "Chicken, rice and greens") => ({
  title,
  meals: [
    { slot: "snack" as const, name: "Yogurt and fruit", foods: [food("Banana", 150, 100, 1), food("Oat cakes", 50, 300, 8)] },
    { slot: "dinner" as const, name: dinner, foods: [food("Grilled chicken", 200, 165, 31), food("Rice", 300, 130, 3), food("Broccoli", 140, 34, 3)] },
  ],
});

describe("buildRecommendationContext", () => {
  it("Given 15:30 local time with 1100 kcal and 60 g protein remaining, Then snack and dinner are the remaining slots", () => {
    const ctx = buildRecommendationContext({
      now: new Date("2026-10-18T13:30:00Z"),
      timezone: "Europe/Copenhagen",
      targets: { kcal: 2800, protein_g: 160, carb_g: 330, fat_g: 80, fiber_g: 39 },
      eaten: { kcal: 1700, protein_g: 100, carb_g: 210, fat_g: 50 },
      loggedMealTypes: ["breakfast", "lunch"],
      weightKg: 80,
      preferences: { diet_type: "vegetarian", allergies: ["peanuts"], dislikes: [], cuisines: ["indian"] },
      runs: [],
    });
    expect(ctx.slots).toEqual(["snack", "dinner"]);
    expect(ctx.remaining).toEqual({ kcal: 1100, protein_g: 60, carb_g: 120, fat_g: 30 });
    expect(ctx.clock).toBe("15:30");
  });
});

describe("recommendMeals", () => {
  it("Given zero remaining kcal, Then no AI call is made and the target is reported met", async () => {
    const { client, parse } = mockClient();
    const r = await recommendMeals(client, context({ remaining: { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 } }), offline);
    expect(r).toEqual({ kind: "target_met" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("Given options, Then each is recomputed and an option more than 15% off the remaining kcal is dropped", async () => {
    const overshoot = { ...fitting("Too big"), meals: [...fitting("x").meals, { slot: "snack" as const, name: "Extra", foods: [food("Granola", 100, 450)] }] };
    const { client } = mockClient({ options: [fitting("A"), overshoot, fitting("B")] });
    const r = await recommendMeals(client, context(), offline);
    expect(r.kind).toBe("options");
    if (r.kind !== "options") return;
    expect(r.options.map((o) => o.title)).toEqual(["A", "B"]);
    expect(r.options[0]!.totals.kcal).toBeCloseTo(1067.6, 1);
    expect(r.options[0]!.meals[1]!.foods[0]!.nutrient_source).toBe("estimated");
  });

  it("Given an allergen in an option, Then that option is dropped before display", async () => {
    const { client } = mockClient({ options: [fitting("Satay", "Chicken satay with rice"), fitting("Plain")] });
    const r = await recommendMeals(client, context({ allergies: ["peanuts"] }), offline);
    expect(r.kind === "options" && r.options.map((o) => o.title)).toEqual(["Plain"]);
  });

  it("Given every option fails, Then it regenerates once with the reasons, then reports no fitting suggestions", async () => {
    const tooSmall = { title: "Tiny", meals: [{ slot: "dinner" as const, name: "Soup", foods: [food("Soup", 200, 40)] }] };
    const { client, parse } = mockClient({ options: [tooSmall] }, { options: [tooSmall] });
    const r = await recommendMeals(client, context(), offline);
    expect(r.kind).toBe("none");
    expect(parse).toHaveBeenCalledTimes(2);
    const [retry] = parse.mock.calls[1] as unknown as [{ messages: { content: { text?: string }[] }[] }];
    expect(JSON.stringify(retry.messages)).toMatch(/rejected/i);
  });

  it("passes the vegetarian diet, allergies and cuisines into the prompt", async () => {
    const { client, parse } = mockClient({ options: [fitting("A")] });
    await recommendMeals(client, context({ diet: "vegetarian", allergies: ["peanuts"], cuisines: ["indian"] }), offline);
    const text = JSON.stringify((parse.mock.calls[0] as unknown as [{ messages: unknown }])[0].messages);
    expect(text).toContain("vegetarian");
    expect(text).toContain("peanuts");
    expect(text).toContain("indian");
  });

  it("Given a vegetarian and a chicken option, Then the option is dropped even if the model ignored the diet", async () => {
    const veg = (name: string) => name.replace("Grilled chicken", "Paneer").replace("Chicken", "Paneer");
    const veggie = {
      title: "Veg",
      meals: fitting("Veg").meals.map((m) => ({ ...m, name: veg(m.name), foods: m.foods.map((f) => ({ ...f, name: veg(f.name), search_query: veg(f.name) })) })),
    };
    const { client } = mockClient({ options: [fitting("Meat"), veggie] });
    const r = await recommendMeals(client, context({ diet: "vegetarian" }), offline);
    expect(r.kind === "options" && r.options.map((o) => o.title)).toEqual(["Veg"]);
  });

  it("Given a planned 100-minute run at 18:00 and a request at 14:00, Then the pre-run meal is flagged carb-focused in the prompt", async () => {
    const { client, parse } = mockClient({ options: [fitting("A")] });
    await recommendMeals(
      client,
      context({ clock: "14:00", slots: ["snack", "dinner"], runs: [{ startClock: "18:00", durationMin: 100, status: "planned" }] }),
      offline,
    );
    const text = JSON.stringify((parse.mock.calls[0] as unknown as [{ messages: unknown }])[0].messages);
    expect(text).toMatch(/pre_long_run/);
    expect(text).toMatch(/carbohydrate-focused/);
    expect(text).toMatch(/post-run/i);
  });
});

describe("declined requests", () => {
  it("Given Claude declines, Then the refusal is not swallowed as an unreadable response", async () => {
    const parse = vi.fn(async () => ({ stop_reason: "refusal", parsed_output: null }));
    const client = { beta: { messages: { parse } } } as unknown as StructuredClient;
    await expect(recommendMeals(client, context(), offline)).rejects.toBeInstanceOf(AiRefusalError);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("maps a refusal to ai_declined", () => {
    expect(() => mapAiError(new AiRefusalError())).toThrow(expect.objectContaining({ code: "ai_declined" }));
  });
});
