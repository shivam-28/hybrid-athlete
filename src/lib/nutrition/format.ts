import type { NutrientSource } from "./draft";
import { NUTRIENT_LABELS, type NutrientKey } from "./nutrients";

export const SOURCE_LABELS: Record<NutrientSource, string> = { usda: "USDA", off: "Open Food Facts", estimated: "Estimated" };

export function formatAmount(key: NutrientKey, value: number): string {
  const { unit } = NUTRIENT_LABELS[key];
  const digits = unit === "µg" || key === "iron_mg" ? 1 : 0;
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${unit}`;
}

export const formatKcal = (kcal: number) => `${Math.round(kcal).toLocaleString("en-GB")} kcal`;
export const formatSigned = (kcal: number) => `${kcal > 0 ? "+" : kcal < 0 ? "−" : ""}${Math.abs(kcal).toLocaleString("en-GB")} kcal`;
