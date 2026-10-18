import "server-only";
import type { FoodCandidate } from "@/lib/nutrition/draft";
import { fromOffNutriments, fromUsdaNutrients, withMacroKcal, type Nutrients } from "@/lib/nutrition/nutrients";

export type { FoodCandidate };
export type FoodSource = FoodCandidate["source"];

export interface LookupCache {
  get(source: FoodSource, query: string): Promise<FoodCandidate[] | null>;
  set(source: FoodSource, query: string, candidates: FoodCandidate[]): Promise<void>;
}

export type MatcherDeps = { fetch: typeof fetch; usdaKey: string | undefined; cache: LookupCache; timeoutMs?: number };

export type ItemMatch = {
  nutrient_source: FoodSource | "estimated";
  source_ref: string | null;
  matched_name: string | null;
  per100g: Nutrients;
  alternatives: FoodCandidate[];
};

const DEFAULT_TIMEOUT_MS = 3000;
const PAGE_SIZE = 5;
const MAX_ALTERNATIVES = 5;
const USER_AGENT = "hybrid-athlete/0.1 (open-source fitness app; https://github.com/shivam-28/hybrid-athlete)";

export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);

type UsdaFood = { fdcId: number; description: string; brandOwner?: string; foodNutrients: { nutrientId?: number; value?: number }[] };
type OffProduct = { code?: string; product_name?: string; brands?: string; nutriments?: Record<string, unknown> };

async function fetchJson<T>(deps: MatcherDeps, url: string, headers?: Record<string, string>): Promise<T> {
  const res = await deps.fetch(url, { headers, signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
  return (await res.json()) as T;
}

async function usdaLookup(query: string, deps: MatcherDeps): Promise<FoodCandidate[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", deps.usdaKey!);
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  const body = await fetchJson<{ foods?: UsdaFood[] }>(deps, url.toString());
  return (body.foods ?? []).flatMap((f) => {
    const per100g = withMacroKcal(fromUsdaNutrients(f.foodNutrients ?? []));
    return per100g ? [{ source: "usda" as const, ref: String(f.fdcId), name: f.description, per100g }] : [];
  });
}

async function offLookup(query: string, deps: MatcherDeps): Promise<FoodCandidate[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("fields", "code,product_name,brands,nutriments");
  const body = await fetchJson<{ products?: OffProduct[] }>(deps, url.toString(), { "user-agent": USER_AGENT });
  return (body.products ?? []).flatMap((p) => {
    const per100g = p.nutriments ? withMacroKcal(fromOffNutriments(p.nutriments)) : null;
    if (!per100g || !p.product_name || !p.code) return [];
    const brand = p.brands?.split(",")[0]?.trim();
    return [{ source: "off" as const, ref: p.code, name: brand ? `${p.product_name} (${brand})` : p.product_name, per100g }];
  });
}

/** Cached per (source, normalised query) for 30 days; failures and timeouts are not cached. */
async function lookup(source: FoodSource, query: string, deps: MatcherDeps): Promise<FoodCandidate[]> {
  if (source === "usda" && !deps.usdaKey) return [];
  const key = normalizeQuery(query);
  if (!key) return [];
  const cached = await deps.cache.get(source, key).catch(() => null);
  if (cached) return cached;
  try {
    const candidates = await (source === "usda" ? usdaLookup(key, deps) : offLookup(key, deps));
    await deps.cache.set(source, key, candidates).catch(() => undefined);
    return candidates;
  } catch {
    return [];
  }
}

/** Manual food search across both databases (no AI involved). */
export async function searchFoods(query: string, deps: MatcherDeps): Promise<FoodCandidate[]> {
  const [usda, off] = await Promise.all([lookup("usda", query, deps), lookup("off", query, deps)]);
  return [...usda, ...off];
}

/**
 * Packaged/branded items prefer Open Food Facts, everything else USDA; the other
 * source is the fallback, then the model's own per-100 g estimate ("estimated").
 */
export async function matchItem(item: { query: string; packaged: boolean; estimate: Nutrients }, deps: MatcherDeps): Promise<ItemMatch> {
  const [usda, off] = await Promise.all([lookup("usda", item.query, deps), lookup("off", item.query, deps)]);
  const ordered = item.packaged ? [...off, ...usda] : [...usda, ...off];
  const best = ordered[0];
  if (!best) return { nutrient_source: "estimated", source_ref: null, matched_name: null, per100g: item.estimate, alternatives: [] };
  return {
    nutrient_source: best.source,
    source_ref: best.ref,
    matched_name: best.name,
    per100g: best.per100g,
    alternatives: ordered.slice(0, MAX_ALTERNATIVES),
  };
}
