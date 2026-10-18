import { NextResponse } from "next/server";
import { relogMeal } from "@/server/nutrition/meals";
import { withNutritionUser } from "@/server/nutrition/route";

type Ctx = { params: Promise<{ id: string }> };

/** One tap: same items and grams, saved for today at the current time. */
export function POST(_: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const meal = await relogMeal(supabase, profile, (await params).id);
    return NextResponse.json({ meal }, { status: 201 });
  });
}
