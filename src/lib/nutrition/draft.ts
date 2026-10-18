import { NUTRIENT_KEYS, scaleNutrients, sumNutrients, type Nutrients } from "./nutrients";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MEAL_SOURCES = ["photo", "text", "search", "relog", "planned"] as const;
export type MealSource = (typeof MEAL_SOURCES)[number];
export type Confidence = "low" | "medium" | "high";
export type NutrientSource = "usda" | "off" | "estimated";

export type FoodCandidate = { source: "usda" | "off"; ref: string; name: string; per100g: Nutrients };

/** One editable line on the confirmation screen. Nutrients are always per100g × grams. */
export type DraftItem = {
  name: string;
  grams: number;
  preparation: string | null;
  confidence: Confidence | null;
  quantity_source: "user" | "estimated";
  nutrient_source: NutrientSource;
  source_ref: string | null;
  matched_name: string | null;
  per100g: Nutrients;
  /** The model's own per-100 g estimate, kept so the user can switch back to it. */
  estimate: Nutrients | null;
  alternatives: FoodCandidate[];
};

export type MealDraft = {
  source: MealSource;
  name: string | null;
  photo_path: string | null;
  items: DraftItem[];
  planned_meal_id?: string | null;
};

export const itemNutrients = (item: Pick<DraftItem, "per100g" | "grams">) => scaleNutrients(item.per100g, item.grams);

export function draftTotals(items: readonly Pick<DraftItem, "per100g" | "grams">[]) {
  return sumNutrients(items.map(itemNutrients));
}

type StoredItem = {
  name: string;
  matched_name: string | null;
  grams: number | string;
  nutrient_source: NutrientSource;
  source_ref: string | null;
  per100g: unknown;
  preparation: string | null;
};

/** Saved items → editable draft items (for edit, re-log and "Ate this"). */
export function draftFromItems(items: readonly StoredItem[]): DraftItem[] {
  return items.map((i) => ({
    name: i.name,
    grams: Number(i.grams),
    preparation: i.preparation,
    confidence: null,
    quantity_source: "user",
    nutrient_source: i.nutrient_source,
    source_ref: i.source_ref,
    matched_name: i.matched_name,
    per100g: i.per100g as Nutrients,
    estimate: null,
    alternatives: [],
  }));
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export { NUTRIENT_KEYS };
