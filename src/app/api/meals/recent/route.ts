import { NextResponse } from "next/server";
import { listRecentMeals } from "@/server/nutrition/meals";
import { withNutritionUser } from "@/server/nutrition/route";

/** Favourites plus the 20 most recent distinct meals. */
export function GET() {
  return withNutritionUser(async ({ supabase }) => NextResponse.json({ meals: await listRecentMeals(supabase) }));
}
