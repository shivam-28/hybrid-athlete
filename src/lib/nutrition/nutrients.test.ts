import { describe, expect, it } from "vitest";
import usda from "../../../tests/fixtures/nutrition/usda-rice.json";
import off from "../../../tests/fixtures/nutrition/off-skyr.json";
import { emptyNutrients, fromOffNutriments, fromUsdaNutrients, scaleNutrients, sumNutrients, withMacroKcal } from "./nutrients";

describe("fromUsdaNutrients", () => {
  it("maps nutrient IDs to columns and leaves missing micros null", () => {
    const n = fromUsdaNutrients(usda.foods[0]!.foodNutrients);
    expect(n).toMatchObject({ kcal: 130, protein_g: 2.69, carb_g: 28.2, fat_g: 0.28, fiber_g: 0.4, sodium_mg: 1, b12_ug: 0 });
    expect(n.vitamin_d_ug).toBeNull();
  });

  it("uses Atwater energy when 1008 is absent (Foundation foods)", () => {
    expect(fromUsdaNutrients(usda.foods[1]!.foodNutrients).kcal).toBe(126);
  });
});

describe("fromOffNutriments", () => {
  it("converts grams to mg/µg for micros", () => {
    const n = fromOffNutriments(off.products[0]!.nutriments);
    expect(n).toMatchObject({ kcal: 63, protein_g: 11, sodium_mg: 40, calcium_mg: 120 });
    expect(n.vitamin_d_ug).toBeCloseTo(0.1, 6);
    expect(n.fiber_g).toBeNull();
  });

  it("derives kcal from kJ when only energy_100g is present", () => {
    expect(fromOffNutriments(off.products[1]!.nutriments).kcal).toBeCloseTo(80, 6);
  });
});

describe("withMacroKcal", () => {
  it("fills missing kcal from macros and rejects foods without macros", () => {
    expect(withMacroKcal({ ...emptyNutrients(), protein_g: 10, carb_g: 20, fat_g: 5 })?.kcal).toBe(165);
    expect(withMacroKcal(emptyNutrients())).toBeNull();
  });
});

describe("scaleNutrients / sumNutrients", () => {
  it("scales per-100 g values to grams and keeps unknowns unknown", () => {
    const n = scaleNutrients(fromUsdaNutrients(usda.foods[0]!.foodNutrients), 220);
    expect(n.kcal).toBeCloseTo(286, 6);
    expect(n.vitamin_d_ug).toBeNull();
  });

  it("sums known values and flags nutrients with any unknown item as incomplete", () => {
    const a = { ...emptyNutrients(), kcal: 100, protein_g: 10, carb_g: 0, fat_g: 1, vitamin_d_ug: 1 };
    const b = { ...emptyNutrients(), kcal: 200, protein_g: 5, carb_g: 30, fat_g: 2 };
    const { totals, incomplete } = sumNutrients([a, b]);
    expect(totals.kcal).toBe(300);
    expect(totals.vitamin_d_ug).toBe(1);
    expect(incomplete).toContain("vitamin_d_ug");
    expect(incomplete).not.toContain("kcal");
  });
});
