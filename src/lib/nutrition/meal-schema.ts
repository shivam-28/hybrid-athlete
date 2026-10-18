import { z } from "zod";
import { MEAL_SOURCES, MEAL_TYPES } from "./draft";
import { NUTRIENT_KEYS } from "./nutrients";

const amount = z.number().min(0).max(100_000);
const MACROS = new Set(["kcal", "protein_g", "carb_g", "fat_g"]);

/** Per-100 g nutrients: macros required, micros may be unknown (null). */
export const per100gSchema = z.object(
  Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, MACROS.has(k) ? amount : amount.nullable()])) as unknown as Record<
    (typeof NUTRIENT_KEYS)[number],
    z.ZodType<number | null>
  >,
);

export const mealItemInputSchema = z.object({
  name: z.string().trim().min(1, "Name each item").max(120),
  matched_name: z.string().max(200).nullable().default(null),
  grams: z.number().gt(0, "Grams must be more than 0").max(5000, "Grams must be 5000 or less"),
  quantity_source: z.enum(["user", "estimated"]).default("user"),
  confidence: z.enum(["low", "medium", "high"]).nullable().default(null),
  preparation: z.string().max(60).nullable().default(null),
  nutrient_source: z.enum(["usda", "off", "estimated"]),
  source_ref: z.string().max(60).nullable().default(null),
  per100g: per100gSchema,
});

export const saveMealSchema = z.object({
  source: z.enum(MEAL_SOURCES),
  name: z.string().trim().max(120).nullable().optional(),
  meal_type: z.enum(MEAL_TYPES).optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  photo_path: z.string().nullable().optional(),
  planned_meal_id: z.uuid().nullable().optional(),
  items: z.array(mealItemInputSchema).min(1, "Add at least one item").max(30),
});

export const updateMealSchema = saveMealSchema.pick({ name: true, meal_type: true, occurred_at: true }).extend({
  items: z.array(mealItemInputSchema).min(1, "Add at least one item").max(30),
});

export type MealItemInput = z.input<typeof mealItemInputSchema>;
export type SaveMealInput = z.input<typeof saveMealSchema>;
export type UpdateMealInput = z.input<typeof updateMealSchema>;
