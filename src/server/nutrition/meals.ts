import "server-only";
import { z } from "zod";
import type { Json, Tables } from "@/lib/database.types";
import { draftFromItems, type MealDraft } from "@/lib/nutrition/draft";
import { saveMealSchema, updateMealSchema, type SaveMealInput, type UpdateMealInput } from "@/lib/nutrition/meal-schema";
import { inferMealType, localClock } from "@/lib/nutrition/meal-time";
import { NUTRIENT_KEYS, scaleNutrients, type Nutrients } from "@/lib/nutrition/nutrients";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import type { Db } from "@/server/body/weights";
import { NutritionError } from "./errors";
import { ownsPath, removeMealPhoto, signedMealPhotoUrls } from "./photos";

export type MealRow = Tables<"meals">;
export type MealItemRow = Tables<"meal_items">;
export type MealWithItems = MealRow & { items: MealItemRow[]; photo_url?: string | null };

const RECENT_LIMIT = 20;

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new NutritionError("invalid", parsed.error.issues[0]?.message ?? "Check the meal.", z.flattenError(parsed.error).fieldErrors);
  return parsed.data;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Server-side nutrient computation: per-100 g × grams. Client-sent totals are ignored. */
function itemRows(mealId: string, items: z.output<typeof saveMealSchema>["items"]) {
  return items.map((item, position) => {
    const n = scaleNutrients(item.per100g as Nutrients, item.grams);
    const amounts = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n[k] === null ? null : round(n[k]!, k === "iron_mg" || k.endsWith("_ug") ? 2 : 1)]));
    return {
      meal_id: mealId,
      position,
      name: item.name,
      matched_name: item.matched_name,
      grams: round(item.grams, 1),
      quantity_source: item.quantity_source,
      confidence: item.confidence,
      preparation: item.preparation,
      nutrient_source: item.nutrient_source,
      source_ref: item.source_ref,
      per100g: item.per100g as unknown as NonNullable<Json>,
      ...(amounts as Record<(typeof NUTRIENT_KEYS)[number], number | null> & { kcal: number; protein_g: number; carb_g: number; fat_g: number }),
    };
  });
}

export async function saveMeal(db: Db, profile: Profile, input: SaveMealInput, now = new Date()): Promise<MealRow> {
  const data = parse(saveMealSchema, input);
  if (data.photo_path && !ownsPath(profile.user_id, data.photo_path)) throw new NutritionError("invalid", "That photo doesn't belong to you.");
  const at = data.occurred_at ? new Date(data.occurred_at) : now;

  const { data: meal, error } = await db
    .from("meals")
    .insert({
      occurred_at: at.toISOString(),
      local_date: localDate(at, profile.timezone),
      meal_type: data.meal_type ?? inferMealType(localClock(at, profile.timezone)),
      source: data.source,
      name: data.name || null,
      photo_path: data.photo_path ?? null,
    })
    .select()
    .single();
  if (error) throw new NutritionError("invalid", "The meal could not be saved.");

  const { error: itemsError } = await db.from("meal_items").insert(itemRows(meal.id, data.items));
  if (itemsError) {
    await db.from("meals").delete().eq("id", meal.id);
    throw new NutritionError("invalid", "The meal items could not be saved.");
  }
  if (data.planned_meal_id) {
    await db.from("planned_meals").update({ logged_meal_id: meal.id }).eq("id", data.planned_meal_id);
  }
  return meal;
}

/** Replaces a meal's items and optionally its time, type and name. */
export async function updateMeal(db: Db, profile: Profile, id: string, input: UpdateMealInput): Promise<MealRow> {
  const data = parse(updateMealSchema, input);
  const patch: Partial<MealRow> = {};
  if (data.meal_type) patch.meal_type = data.meal_type;
  if (data.name !== undefined) patch.name = data.name || null;
  if (data.occurred_at) {
    patch.occurred_at = new Date(data.occurred_at).toISOString();
    patch.local_date = localDate(new Date(data.occurred_at), profile.timezone);
  }
  const { data: meal } = await db.from("meals").update(patch).eq("id", id).select().maybeSingle();
  if (!meal) throw new NutritionError("not_found", "Meal not found");
  await db.from("meal_items").delete().eq("meal_id", id);
  const { error } = await db.from("meal_items").insert(itemRows(id, data.items));
  if (error) throw new NutritionError("invalid", "The meal items could not be saved.");
  return meal;
}

export async function deleteMeal(db: Db, id: string): Promise<void> {
  const { data } = await db.from("meals").delete().eq("id", id).select("photo_path").maybeSingle();
  if (!data) throw new NutritionError("not_found", "Meal not found");
  if (data.photo_path) await removeMealPhoto(db, data.photo_path);
}

export async function setFavorite(db: Db, id: string, isFavorite: boolean): Promise<void> {
  const { data } = await db.from("meals").update({ is_favorite: isFavorite }).eq("id", id).select("id").maybeSingle();
  if (!data) throw new NutritionError("not_found", "Meal not found");
}

const sortItems = (m: MealRow & { meal_items: MealItemRow[] }): MealWithItems => {
  const { meal_items, ...meal } = m;
  return { ...meal, items: [...meal_items].sort((a, b) => a.position - b.position) };
};

export async function listDayMeals(db: Db, date: string): Promise<MealWithItems[]> {
  const { data, error } = await db.from("meals").select("*, meal_items(*)").eq("local_date", date).order("occurred_at");
  if (error) throw error;
  const meals = data.map(sortItems);
  const urls = await signedMealPhotoUrls(db, meals.flatMap((m) => (m.photo_path ? [m.photo_path] : [])));
  return meals.map((m) => ({ ...m, photo_url: m.photo_path ? (urls.get(m.photo_path) ?? null) : null }));
}

const signature = (m: MealWithItems) => m.items.map((i) => `${i.name.toLowerCase()}:${Number(i.grams)}`).join("|");

/** Favourites first, then the 20 most recent meals with distinct contents. */
export async function listRecentMeals(db: Db): Promise<MealWithItems[]> {
  const [favorites, recent] = await Promise.all([
    db.from("meals").select("*, meal_items(*)").eq("is_favorite", true).order("occurred_at", { ascending: false }).limit(RECENT_LIMIT),
    db.from("meals").select("*, meal_items(*)").order("occurred_at", { ascending: false }).limit(100),
  ]);
  if (favorites.error) throw favorites.error;
  if (recent.error) throw recent.error;
  const seen = new Set<string>();
  const out: MealWithItems[] = [];
  for (const meal of [...favorites.data.map(sortItems), ...recent.data.map(sortItems)]) {
    const key = signature(meal);
    if (meal.items.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(meal);
    if (out.length >= RECENT_LIMIT + favorites.data.length) break;
  }
  return out;
}

/** One-tap re-log: same items and grams, today, now. Still editable afterwards. */
export async function relogMeal(db: Db, profile: Profile, id: string, now = new Date()): Promise<MealRow> {
  const { data } = await db.from("meals").select("*, meal_items(*)").eq("id", id).maybeSingle();
  if (!data) throw new NutritionError("not_found", "Meal not found");
  const meal = sortItems(data);
  const draft: MealDraft = { source: "relog", name: meal.name, photo_path: null, items: draftFromItems(meal.items) };
  return saveMeal(db, profile, { source: "relog", name: draft.name, items: draft.items }, now);
}
