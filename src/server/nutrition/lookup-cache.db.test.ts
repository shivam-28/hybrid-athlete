import { afterAll, describe, expect, it } from "vitest";
import { adminClient } from "../../../tests/supabase-test-helpers";
import { emptyNutrients } from "@/lib/nutrition/nutrients";
import { supabaseLookupCache } from "./lookup-cache";

const query = `test-query-${Date.now()}`;
const candidate = { source: "usda" as const, ref: "1", name: "Rice", per100g: { ...emptyNutrients(), kcal: 130, protein_g: 2.7, carb_g: 28, fat_g: 0.3 } };

afterAll(async () => {
  await adminClient().from("food_lookup_cache").delete().eq("query_normalized", query);
});

describe("supabaseLookupCache", () => {
  it("returns a stored lookup within 30 days", async () => {
    const cache = supabaseLookupCache(() => new Date("2026-10-18T12:00:00Z"));
    await cache.set("usda", query, [candidate]);
    expect(await cache.get("usda", query)).toEqual([candidate]);
    expect(await cache.get("off", query)).toBeNull();
  });

  it("ignores entries older than 30 days", async () => {
    const later = supabaseLookupCache(() => new Date("2026-11-18T12:00:01Z"));
    expect(await later.get("usda", query)).toBeNull();
  });
});
