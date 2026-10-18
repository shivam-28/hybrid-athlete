/** Nutrient columns stored per meal item (design D5/D6). Micros are null when the source has no value. */
export const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carb_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "satfat_g",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "vitamin_d_ug",
  "b12_ug",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Record<NutrientKey, number | null>;

export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: "Energy", unit: "kcal" },
  protein_g: { label: "Protein", unit: "g" },
  carb_g: { label: "Carbs", unit: "g" },
  fat_g: { label: "Fat", unit: "g" },
  fiber_g: { label: "Fiber", unit: "g" },
  sugar_g: { label: "Sugar", unit: "g" },
  satfat_g: { label: "Saturated fat", unit: "g" },
  sodium_mg: { label: "Sodium", unit: "mg" },
  potassium_mg: { label: "Potassium", unit: "mg" },
  calcium_mg: { label: "Calcium", unit: "mg" },
  iron_mg: { label: "Iron", unit: "mg" },
  magnesium_mg: { label: "Magnesium", unit: "mg" },
  vitamin_d_ug: { label: "Vitamin D", unit: "µg" },
  b12_ug: { label: "Vitamin B12", unit: "µg" },
};

export const emptyNutrients = (): Nutrients => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) as Nutrients;

// USDA FoodData Central nutrient IDs (values are per 100 g in search results).
// Foundation foods often report energy only as Atwater factors (2047/2048).
const USDA_IDS: Record<NutrientKey, number[]> = {
  kcal: [1008, 2047, 2048],
  protein_g: [1003],
  carb_g: [1005],
  fat_g: [1004],
  fiber_g: [1079],
  sugar_g: [2000, 1063],
  satfat_g: [1258],
  sodium_mg: [1093],
  potassium_mg: [1092],
  calcium_mg: [1087],
  iron_mg: [1089],
  magnesium_mg: [1090],
  vitamin_d_ug: [1114],
  b12_ug: [1178],
};

export function fromUsdaNutrients(list: readonly { nutrientId?: number; value?: number }[]): Nutrients {
  const byId = new Map(list.filter((n) => typeof n.value === "number").map((n) => [n.nutrientId, n.value!]));
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, USDA_IDS[key].map((id) => byId.get(id)).find((v) => v !== undefined) ?? null]),
  ) as Nutrients;
}

// Open Food Facts reports everything per 100 g in grams; micros are converted to mg/µg.
const OFF_FIELDS: Record<NutrientKey, { field: string; factor: number }> = {
  kcal: { field: "energy-kcal_100g", factor: 1 },
  protein_g: { field: "proteins_100g", factor: 1 },
  carb_g: { field: "carbohydrates_100g", factor: 1 },
  fat_g: { field: "fat_100g", factor: 1 },
  fiber_g: { field: "fiber_100g", factor: 1 },
  sugar_g: { field: "sugars_100g", factor: 1 },
  satfat_g: { field: "saturated-fat_100g", factor: 1 },
  sodium_mg: { field: "sodium_100g", factor: 1000 },
  potassium_mg: { field: "potassium_100g", factor: 1000 },
  calcium_mg: { field: "calcium_100g", factor: 1000 },
  iron_mg: { field: "iron_100g", factor: 1000 },
  magnesium_mg: { field: "magnesium_100g", factor: 1000 },
  vitamin_d_ug: { field: "vitamin-d_100g", factor: 1_000_000 },
  b12_ug: { field: "vitamin-b12_100g", factor: 1_000_000 },
};

const KJ_PER_KCAL = 4.184;

export function fromOffNutriments(nutriments: Record<string, unknown>): Nutrients {
  const read = (field: string) => {
    const v = nutriments[field];
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const out = Object.fromEntries(
    NUTRIENT_KEYS.map((key) => {
      const v = read(OFF_FIELDS[key].field);
      return [key, v === null ? null : v * OFF_FIELDS[key].factor];
    }),
  ) as Nutrients;
  if (out.kcal === null) {
    const kj = read("energy_100g") ?? read("energy-kj_100g");
    if (kj !== null) out.kcal = kj / KJ_PER_KCAL;
  }
  return out;
}

/** A usable food needs protein, carbs and fat; kcal is derived from them when the source omits it. */
export function withMacroKcal(n: Nutrients): Nutrients | null {
  if (n.protein_g === null || n.carb_g === null || n.fat_g === null) return null;
  return n.kcal === null ? { ...n, kcal: 4 * n.protein_g + 4 * n.carb_g + 9 * n.fat_g } : n;
}

export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, per100g[k] === null ? null : (per100g[k]! * grams) / 100])) as Nutrients;
}

/** Sums known values; any nutrient unknown for at least one item is reported as incomplete. */
export function sumNutrients(items: readonly Nutrients[]): { totals: Record<NutrientKey, number>; incomplete: NutrientKey[] } {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, items.reduce((s, n) => s + (n[k] ?? 0), 0)])) as Record<NutrientKey, number>;
  const incomplete = NUTRIENT_KEYS.filter((k) => items.some((n) => n[k] === null));
  return { totals, incomplete };
}
