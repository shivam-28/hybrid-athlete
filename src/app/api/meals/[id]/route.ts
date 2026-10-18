import { NextResponse } from "next/server";
import { deleteMeal, updateMeal } from "@/server/nutrition/meals";
import { withNutritionUser } from "@/server/nutrition/route";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(request: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const meal = await updateMeal(supabase, profile, (await params).id, await request.json().catch(() => ({})));
    return NextResponse.json({ meal });
  });
}

/** Removes the meal, its items and its photo. */
export function DELETE(_: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase }) => {
    await deleteMeal(supabase, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
