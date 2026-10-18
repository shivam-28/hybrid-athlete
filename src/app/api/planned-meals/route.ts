import { NextResponse } from "next/server";
import { z } from "zod";
import { MEAL_TYPES } from "@/lib/nutrition/draft";
import { per100gSchema } from "@/lib/nutrition/meal-schema";
import { savePlannedOption } from "@/server/nutrition/planned";
import { readBody, withNutritionUser } from "@/server/nutrition/route";

const macros = z.object({ kcal: z.number(), protein_g: z.number(), carb_g: z.number(), fat_g: z.number() });
const optionSchema = z.object({
  title: z.string().max(120),
  totals: macros,
  meals: z
    .array(
      z.object({
        slot: z.enum(MEAL_TYPES),
        name: z.string().min(1).max(120),
        totals: macros,
        foods: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              grams: z.number().gt(0).max(2000),
              nutrient_source: z.enum(["usda", "off", "estimated"]),
              source_ref: z.string().max(60).nullable(),
              matched_name: z.string().max(200).nullable(),
              per100g: per100gSchema,
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(4),
});

/** Saves a recommended option's meals as today's planned meals. */
export function POST(request: Request) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const option = await readBody(request, optionSchema);
    return NextResponse.json({ planned: await savePlannedOption(supabase, profile, option as never) }, { status: 201 });
  });
}
