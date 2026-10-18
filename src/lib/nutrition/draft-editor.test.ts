import { describe, expect, it } from "vitest";
import type { DraftItem, MealDraft } from "./draft";
import { draftTotals } from "./draft";
import { draftEditor } from "./draft-editor";
import { emptyNutrients } from "./nutrients";

const rice = { ...emptyNutrients(), kcal: 130, protein_g: 2.7, carb_g: 28.2, fat_g: 0.3 };
const brown = { ...emptyNutrients(), kcal: 123, protein_g: 2.7, carb_g: 25.6, fat_g: 1 };
const estimate = { ...emptyNutrients(), kcal: 140, protein_g: 3, carb_g: 30, fat_g: 1 };
const item: DraftItem = {
  name: "Rice",
  grams: 150,
  preparation: "boiled",
  confidence: "medium",
  quantity_source: "estimated",
  nutrient_source: "usda",
  source_ref: "1",
  matched_name: "Rice, white, cooked",
  per100g: rice,
  estimate,
  alternatives: [
    { source: "usda", ref: "1", name: "Rice, white, cooked", per100g: rice },
    { source: "usda", ref: "2", name: "Rice, brown, cooked", per100g: brown },
  ],
};
const draft: MealDraft = { source: "photo", name: "Lunch", photo_path: null, items: [item] };

describe("draftEditor", () => {
  it("Given rice at 150 g, When changed to 220 g, Then the item's and meal's nutrients scale to 220 g", () => {
    expect(draftTotals(draft.items).totals.kcal).toBeCloseTo(195, 6);
    const next = draftEditor(draft, { type: "grams", index: 0, grams: 220 });
    expect(next.items[0]!.grams).toBe(220);
    expect(next.items[0]!.quantity_source).toBe("user");
    expect(draftTotals(next.items).totals.kcal).toBeCloseTo(286, 6);
  });

  it("swaps the matched food from the alternatives", () => {
    const next = draftEditor(draft, { type: "swap", index: 0, ref: "usda:2" });
    expect(next.items[0]).toMatchObject({ source_ref: "2", matched_name: "Rice, brown, cooked", nutrient_source: "usda", per100g: brown });
  });

  it("can switch back to the model's estimate", () => {
    const next = draftEditor(draft, { type: "swap", index: 0, ref: "estimated" });
    expect(next.items[0]).toMatchObject({ nutrient_source: "estimated", source_ref: null, per100g: estimate });
  });

  it("adds and removes items", () => {
    const added = draftEditor(draft, { type: "add", candidate: { source: "off", ref: "9", name: "Skyr (Arla)", per100g: rice }, grams: 170 });
    expect(added.items.map((i) => [i.name, i.grams, i.nutrient_source])).toEqual([
      ["Rice", 150, "usda"],
      ["Skyr (Arla)", 170, "off"],
    ]);
    expect(draftEditor(added, { type: "remove", index: 0 }).items.map((i) => i.name)).toEqual(["Skyr (Arla)"]);
  });

  it("ignores invalid gram values", () => {
    expect(draftEditor(draft, { type: "grams", index: 0, grams: Number.NaN })).toBe(draft);
    expect(draftEditor(draft, { type: "grams", index: 0, grams: -3 }).items[0]!.grams).toBe(150);
  });
});
