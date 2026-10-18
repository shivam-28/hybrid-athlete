import "server-only";
import type { Json, Tables } from "@/lib/database.types";
import type { MealDraft } from "@/lib/nutrition/draft";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import type { Db } from "@/server/body/weights";
import { NutritionError } from "./errors";
import type { RecommendedFood, RecommendedOption } from "./recommend";

export type PlannedMealRow = Tables<"planned_meals">;

/** Saves each meal of a chosen option as a planned meal for today. Planned meals never count as intake. */
export async function savePlannedOption(db: Db, profile: Profile, option: RecommendedOption, now = new Date()): Promise<PlannedMealRow[]> {
  const date = localDate(now, profile.timezone);
  const { data, error } = await db
    .from("planned_meals")
    .insert(option.meals.map((m) => ({ local_date: date, slot: m.slot, name: m.name.slice(0, 120), items: m.foods as unknown as NonNullable<Json> })))
    .select();
  if (error) throw new NutritionError("invalid", "The plan could not be saved.");
  return data;
}

/** Planned meals for a day that haven't been logged yet. */
export async function listPlanned(db: Db, date: string): Promise<PlannedMealRow[]> {
  const { data, error } = await db.from("planned_meals").select("*").eq("local_date", date).is("logged_meal_id", null).order("created_at");
  if (error) throw error;
  const order = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 } as const;
  return [...data].sort((a, b) => order[a.slot] - order[b.slot]);
}

/** "Ate this": a draft prefilled with the planned items, confirmed like any other meal. */
export async function plannedDraft(db: Db, id: string): Promise<MealDraft> {
  const { data } = await db.from("planned_meals").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NutritionError("not_found", "Planned meal not found");
  const foods = data.items as unknown as RecommendedFood[];
  return {
    source: "planned",
    name: data.name,
    photo_path: null,
    planned_meal_id: data.id,
    items: foods.map((f) => ({
      name: f.name,
      grams: f.grams,
      preparation: null,
      confidence: null,
      quantity_source: "estimated",
      nutrient_source: f.nutrient_source,
      source_ref: f.source_ref,
      matched_name: f.matched_name,
      per100g: f.per100g as Nutrients,
      estimate: null,
      alternatives: [],
    })),
  };
}

export async function deletePlanned(db: Db, id: string): Promise<void> {
  const { data } = await db.from("planned_meals").delete().eq("id", id).select("id").maybeSingle();
  if (!data) throw new NutritionError("not_found", "Planned meal not found");
}
