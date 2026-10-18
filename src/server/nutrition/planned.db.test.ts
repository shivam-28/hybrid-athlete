import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { emptyNutrients } from "@/lib/nutrition/nutrients";
import type { Profile } from "@/server/auth";
import { loadDay } from "./day";
import { saveMeal } from "./meals";
import { listPlanned, plannedDraft, savePlannedOption } from "./planned";
import type { RecommendedOption } from "./recommend";

const NOW = new Date("2026-10-18T13:30:00Z");
let u: TestUser;
let profile: Profile;
const per100g = { ...emptyNutrients(), kcal: 150, protein_g: 12, carb_g: 15, fat_g: 4 };

const option: RecommendedOption = {
  title: "Pasta night",
  totals: { kcal: 1050, protein_g: 70, carb_g: 120, fat_g: 30 },
  meals: [
    { slot: "snack", name: "Skyr and berries", totals: { kcal: 300, protein_g: 25, carb_g: 30, fat_g: 5 }, foods: [{ name: "Skyr", grams: 200, nutrient_source: "off", source_ref: "571", matched_name: "Skyr (Arla)", per100g }] },
    {
      slot: "dinner",
      name: "Chicken pasta",
      totals: { kcal: 750, protein_g: 45, carb_g: 90, fat_g: 25 },
      foods: [
        { name: "Pasta", grams: 300, nutrient_source: "usda", source_ref: "1", matched_name: "Pasta, cooked", per100g },
        { name: "Chicken", grams: 150, nutrient_source: "estimated", source_ref: null, matched_name: null, per100g },
      ],
    },
  ],
};

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
  await u.client.from("body_weights").insert({ occurred_at: "2026-10-17T05:00:00Z", local_date: "2026-10-17", weight_kg: 80 });
});

afterAll(() => deleteTestUser(u));

describe("planned meals", () => {
  it("Given a saved option, Then its meals are planned for today and excluded from intake totals", async () => {
    await savePlannedOption(u.client, profile, option, NOW);
    const planned = await listPlanned(u.client, "2026-10-18");
    expect(planned.map((p) => [p.slot, p.name])).toEqual([
      ["snack", "Skyr and berries"],
      ["dinner", "Chicken pasta"],
    ]);
    const day = await loadDay(u.client, profile, "2026-10-18", NOW);
    expect(day.totals.kcal).toBe(0);
  });

  it("Given a planned dinner, When 'Ate this' is used, Then a prefilled draft is produced and logging it counts toward totals", async () => {
    const dinner = (await listPlanned(u.client, "2026-10-18")).find((p) => p.slot === "dinner")!;
    const draft = await plannedDraft(u.client, dinner.id);
    expect(draft).toMatchObject({ source: "planned", planned_meal_id: dinner.id, name: "Chicken pasta" });
    expect(draft.items.map((i) => [i.name, i.grams])).toEqual([
      ["Pasta", 300],
      ["Chicken", 150],
    ]);

    await saveMeal(u.client, profile, { ...draft, meal_type: "dinner", items: draft.items }, new Date("2026-10-18T17:30:00Z"));
    expect((await listPlanned(u.client, "2026-10-18")).map((p) => p.slot)).toEqual(["snack"]);
    const day = await loadDay(u.client, profile, "2026-10-18", NOW);
    expect(day.totals.kcal).toBeCloseTo(675, 6);
  });
});
