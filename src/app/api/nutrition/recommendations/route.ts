import { NextResponse } from "next/server";
import { z } from "zod";
import { recommendForUser } from "@/server/nutrition/day";
import { readBody, withNutritionUser } from "@/server/nutrition/route";

/** 2–3 rest-of-day options (or light snacks once the target is met). 409 missing_ai_key without a key. */
export function POST(request: Request) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const { mode } = await readBody(request, z.object({ mode: z.enum(["rest_of_day", "light_snack"]).default("rest_of_day") }));
    return NextResponse.json(await recommendForUser(supabase, profile, mode));
  });
}
