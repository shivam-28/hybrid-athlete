import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MealDraft } from "@/lib/nutrition/draft";
import { draftEditor } from "@/lib/nutrition/draft-editor";
import { emptyNutrients } from "@/lib/nutrition/nutrients";
import { NutritionTodayCard } from "./nutrition-today-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
const { MealConfirm } = await import("./meal-confirm");

const rice = { ...emptyNutrients(), kcal: 130, protein_g: 2.7, carb_g: 28.2, fat_g: 0.3 };
const draft: MealDraft = {
  source: "photo",
  name: null,
  photo_path: null,
  items: [
    { name: "Rice", grams: 150, preparation: null, confidence: "low", quantity_source: "estimated", nutrient_source: "usda", source_ref: "1", matched_name: "Rice", per100g: rice, estimate: null, alternatives: [] },
  ],
};

const render = (d: MealDraft) =>
  renderToStaticMarkup(<MealConfirm initial={d} mode={{ kind: "new" }} defaultMealType="lunch" onDone={() => {}} />);

describe("MealConfirm", () => {
  it("Given rice changed from 150 g to 220 g, Then the item and meal totals show 220 g values", () => {
    expect(render(draft)).toContain("Total: 195 kcal");
    const html = render(draftEditor(draft, { type: "grams", index: 0, grams: 220 }));
    expect(html).toContain("Total: 286 kcal");
    expect(html).toContain('data-testid="item-nutrients">286 kcal');
  });

  it("highlights low-confidence items and shows the accuracy notice for photo estimates", () => {
    const html = render(draft);
    expect(html).toContain("Please check this item");
    expect(html).toContain("20–30%");
  });
});

describe("NutritionTodayCard", () => {
  it("renders kcal and macro progress with a snap-meal action", () => {
    const html = renderToStaticMarkup(
      <NutritionTodayCard targets={{ kcal: 2800, protein_g: 144, carb_g: 381, fat_g: 78, fiber_g: 39 }} eaten={{ kcal: 1900, protein_g: 100, carb_g: 200, fat_g: 60 }} />,
    );
    expect(html).toContain("1,900 / 2,800 kcal");
    expect(html).toContain("900 kcal left");
    expect(html).toContain("P 100/144 g");
    expect(html).toContain("Snap meal");
  });
});
