import { NextResponse, type NextRequest } from "next/server";
import { defaultMatcherDeps } from "@/server/nutrition/lookup-cache";
import { searchFoods } from "@/server/nutrition/matcher";
import { NutritionError } from "@/server/nutrition/errors";
import { withNutritionUser } from "@/server/nutrition/route";

/** Manual food search (USDA + Open Food Facts). Works without an AI key. */
export function GET(request: NextRequest) {
  return withNutritionUser(async () => {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2 || q.length > 100) throw new NutritionError("invalid", "Search with 2–100 characters.");
    return NextResponse.json({ results: await searchFoods(q, defaultMatcherDeps()) });
  });
}
