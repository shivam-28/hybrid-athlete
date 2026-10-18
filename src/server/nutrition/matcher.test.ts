import { describe, expect, it, vi } from "vitest";
import usda from "../../../tests/fixtures/nutrition/usda-rice.json";
import off from "../../../tests/fixtures/nutrition/off-skyr.json";
import { emptyNutrients } from "@/lib/nutrition/nutrients";
import { matchItem, searchFoods, type FoodCandidate, type LookupCache, type MatcherDeps } from "./matcher";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function memoryCache(): LookupCache & { store: Map<string, FoodCandidate[]> } {
  const store = new Map<string, FoodCandidate[]>();
  return {
    store,
    get: async (source, query) => store.get(`${source}:${query}`) ?? null,
    set: async (source, query, candidates) => void store.set(`${source}:${query}`, candidates),
  };
}

function deps(fetchImpl: typeof fetch, overrides: Partial<MatcherDeps> = {}): MatcherDeps {
  return { fetch: fetchImpl, usdaKey: "TEST_KEY", cache: memoryCache(), timeoutMs: 3000, ...overrides };
}

const routeFetch = (handlers: { usda?: () => Promise<Response>; off?: () => Promise<Response> }) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.nal.usda.gov")) return handlers.usda ? handlers.usda() : json({ foods: [] });
    if (url.includes("openfoodfacts.org")) return handlers.off ? handlers.off() : json({ products: [] });
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const estimate = { ...emptyNutrients(), kcal: 150, protein_g: 9, carb_g: 18, fat_g: 4 };

describe("matchItem", () => {
  it("Given a generic food, Then USDA nutrients are used with alternatives from both sources", async () => {
    const f = routeFetch({ usda: async () => json(usda), off: async () => json(off) });
    const m = await matchItem({ query: "cooked white rice", packaged: false, estimate }, deps(f));
    expect(m.nutrient_source).toBe("usda");
    expect(m.source_ref).toBe("2512381");
    expect(m.per100g.kcal).toBe(130);
    expect(m.alternatives.length).toBeGreaterThan(1);
    expect(m.alternatives.length).toBeLessThanOrEqual(5);
  });

  it("Given a packaged product, Then Open Food Facts is preferred", async () => {
    const f = routeFetch({ usda: async () => json(usda), off: async () => json(off) });
    const m = await matchItem({ query: "arla skyr", packaged: true, estimate }, deps(f));
    expect(m.nutrient_source).toBe("off");
    expect(m.matched_name).toBe("Skyr Naturel (Arla)");
  });

  it("Given no database match, Then the model estimate is used and labelled estimated", async () => {
    const f = routeFetch({});
    const m = await matchItem({ query: "grandma's lentil dal", packaged: false, estimate }, deps(f));
    expect(m).toMatchObject({ nutrient_source: "estimated", source_ref: null, per100g: estimate, alternatives: [] });
  });

  it("Given both databases time out, Then it falls back to the estimate within the timeout", async () => {
    const hang = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const started = Date.now();
    const m = await matchItem({ query: "rice", packaged: false, estimate }, deps(hang as typeof fetch, { timeoutMs: 50 }));
    expect(m.nutrient_source).toBe("estimated");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("Given a failing database, Then the failure is not cached", async () => {
    const cache = memoryCache();
    const f = routeFetch({ usda: async () => new Response("down", { status: 503 }) });
    await matchItem({ query: "rice", packaged: false, estimate }, deps(f, { cache }));
    expect(cache.store.has("usda:rice")).toBe(false);
  });

  it("Given a cached lookup, Then no network call is made", async () => {
    const cache = memoryCache();
    const first = routeFetch({ usda: async () => json(usda), off: async () => json(off) });
    await matchItem({ query: "Cooked  White Rice ", packaged: false, estimate }, deps(first, { cache }));
    const second = routeFetch({});
    const m = await matchItem({ query: "cooked white rice", packaged: false, estimate }, deps(second, { cache }));
    expect(second).not.toHaveBeenCalled();
    expect(m.nutrient_source).toBe("usda");
  });

  it("Given no USDA key, Then USDA is skipped and Open Food Facts is still used", async () => {
    const f = routeFetch({ off: async () => json(off) });
    const m = await matchItem({ query: "skyr", packaged: false, estimate }, deps(f, { usdaKey: undefined }));
    expect(m.nutrient_source).toBe("off");
    expect(f.mock.calls.every(([url]) => !String(url).includes("usda"))).toBe(true);
  });

  it("sends a descriptive User-Agent to Open Food Facts", async () => {
    const f = routeFetch({ off: async () => json(off) });
    await matchItem({ query: "skyr", packaged: true, estimate }, deps(f));
    const offCall = f.mock.calls.find(([url]) => String(url).includes("openfoodfacts"))!;
    expect(new Headers((offCall[1] as RequestInit).headers).get("user-agent")).toMatch(/hybrid-athlete/);
  });
});

describe("searchFoods", () => {
  it("returns labelled results from both sources, skipping products without macros", async () => {
    const f = routeFetch({ usda: async () => json(usda), off: async () => json(off) });
    const r = await searchFoods("skyr", deps(f));
    expect(r.every((c) => c.source === "usda" || c.source === "off")).toBe(true);
    expect(r.map((c) => c.name)).not.toContain("Mystery product");
    expect(r.filter((c) => c.source === "off")).toHaveLength(2);
  });
});
