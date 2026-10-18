import "server-only";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/server/supabase-admin";
import type { FoodCandidate, LookupCache, MatcherDeps } from "./matcher";

export const CACHE_TTL_MS = 30 * 24 * 3_600_000;

/**
 * Instance-wide cache of USDA/OFF lookups. The table holds no user data and has no
 * client policies, so only the server (service role) may read or write it: users
 * cannot plant entries that other users would see.
 */
export function supabaseLookupCache(now: () => Date = () => new Date()): LookupCache {
  const admin = createAdminClient();
  return {
    async get(source, query) {
      const { data } = await admin
        .from("food_lookup_cache")
        .select("payload, fetched_at")
        .eq("source", source)
        .eq("query_normalized", query)
        .maybeSingle();
      if (!data || now().getTime() - Date.parse(data.fetched_at) > CACHE_TTL_MS) return null;
      return data.payload as unknown as FoodCandidate[];
    },
    async set(source, query, candidates) {
      await admin.from("food_lookup_cache").upsert({
        source,
        query_normalized: query,
        payload: candidates as unknown as NonNullable<Json>,
        fetched_at: now().toISOString(),
      });
    },
  };
}

export function defaultMatcherDeps(): MatcherDeps {
  return { fetch, usdaKey: process.env.USDA_FDC_API_KEY || undefined, cache: supabaseLookupCache() };
}
