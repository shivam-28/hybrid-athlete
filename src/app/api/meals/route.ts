import { NextResponse } from "next/server";
import { saveMeal } from "@/server/nutrition/meals";
import { withNutritionUser } from "@/server/nutrition/route";

/** Saves a confirmed draft. Nutrients are recomputed server-side from per-100 g × grams. */
export function POST(request: Request) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const meal = await saveMeal(supabase, profile, await request.json().catch(() => ({})));
    return NextResponse.json({ meal }, { status: 201 });
  });
}
