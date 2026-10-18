import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { emptyNutrients, type Nutrients } from "@/lib/nutrition/nutrients";
import type { Profile } from "@/server/auth";
import { deleteMeal, listDayMeals, listRecentMeals, relogMeal, saveMeal, setFavorite, updateMeal } from "./meals";

let u: TestUser;
let other: TestUser;
let profile: Profile;
const rice = { ...emptyNutrients(), kcal: 130, protein_g: 2.7, carb_g: 28.2, fat_g: 0.3, fiber_g: 0.4 };
const chicken = { ...emptyNutrients(), kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6 };
const item = (name: string, grams: number, per100g: Nutrients = rice) => ({
  name,
  grams,
  quantity_source: "estimated" as const,
  confidence: "medium" as const,
  preparation: null,
  nutrient_source: "usda" as const,
  source_ref: "1",
  matched_name: name,
  per100g,
});
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  profile = (await u.client.from("profiles").select("*").single()).data!;
});

afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

describe("saveMeal", () => {
  it("Given a confirmed draft at 12:40 Copenhagen time, Then it is saved as today's lunch with server-computed nutrients", async () => {
    const meal = await saveMeal(
      u.client,
      profile,
      { source: "photo", items: [{ ...item("Rice", 220), kcal: 1, protein_g: 999 } as never, item("Chicken", 150, chicken)] },
      new Date("2026-10-18T10:40:00Z"),
    );
    expect(meal.meal_type).toBe("lunch");
    expect(meal.local_date).toBe("2026-10-18");
    const { data: items } = await u.client.from("meal_items").select("name, kcal, protein_g, vitamin_d_ug").eq("meal_id", meal.id).order("position");
    expect(items![0]).toEqual({ name: "Rice", kcal: 286, protein_g: 5.9, vitamin_d_ug: null });
    expect(items![1]!.kcal).toBe(247.5);
  });

  it("rejects a photo path in someone else's folder", async () => {
    await expect(
      saveMeal(u.client, profile, { source: "photo", photo_path: `${other.id}/x.jpg`, items: [item("Rice", 100)] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects implausible grams", async () => {
    await expect(saveMeal(u.client, profile, { source: "search", items: [item("Rice", 0)] })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("updateMeal / deleteMeal", () => {
  it("Given a saved meal, When grams and type are edited, Then items and totals are replaced", async () => {
    const meal = await saveMeal(u.client, profile, { source: "search", items: [item("Rice", 100)] }, new Date("2026-10-18T06:00:00Z"));
    await updateMeal(u.client, profile, meal.id, { meal_type: "snack", items: [item("Rice", 200)] });
    const day = await listDayMeals(u.client, "2026-10-18");
    const updated = day.find((m) => m.id === meal.id)!;
    expect(updated.meal_type).toBe("snack");
    expect(updated.items.map((i) => Number(i.kcal))).toEqual([260]);
  });

  it("Given a meal with a photo, When deleted, Then the meal, its items and its photo are removed", async () => {
    const path = `${u.id}/meal-to-delete.jpg`;
    await u.client.storage.from("meal-photos").upload(path, jpeg());
    const meal = await saveMeal(u.client, profile, { source: "photo", photo_path: path, items: [item("Rice", 100)] });
    await deleteMeal(u.client, meal.id);
    expect((await u.client.from("meals").select("id").eq("id", meal.id)).data).toEqual([]);
    expect((await adminClient().from("meal_items").select("id").eq("meal_id", meal.id)).data).toEqual([]);
    expect((await u.client.storage.from("meal-photos").download(path)).data).toBeNull();
  });

  it("Given another user's meal id, When deleting, Then not_found", async () => {
    const meal = await saveMeal(u.client, profile, { source: "search", items: [item("Rice", 100)] });
    const otherProfile = { ...profile, user_id: other.id };
    await expect(deleteMeal(other.client, meal.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(updateMeal(other.client, otherProfile, meal.id, { items: [item("Rice", 1)] })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("favourites and re-log", () => {
  it("Given a favourite breakfast, When re-logged, Then a new meal for today has identical items and grams", async () => {
    const original = await saveMeal(
      u.client,
      profile,
      { source: "search", name: "oats + whey + banana", items: [item("Oats", 60), item("Whey", 30, chicken), item("Banana", 120)] },
      new Date("2026-10-15T06:00:00Z"),
    );
    await setFavorite(u.client, original.id, true);
    const copy = await relogMeal(u.client, profile, original.id, new Date("2026-10-18T06:30:00Z"));
    expect(copy.id).not.toBe(original.id);
    expect(copy.local_date).toBe("2026-10-18");
    expect(copy.source).toBe("relog");
    const day = await listDayMeals(u.client, "2026-10-18");
    expect(day.find((m) => m.id === copy.id)!.items.map((i) => [i.name, Number(i.grams)])).toEqual([
      ["Oats", 60],
      ["Whey", 30],
      ["Banana", 120],
    ]);
  });

  it("lists favourites first, then recent distinct meals", async () => {
    const recent = await listRecentMeals(u.client);
    expect(recent[0]!.is_favorite).toBe(true);
    const names = recent.map((m) => m.items.map((i) => `${i.name}:${i.grams}`).join("|"));
    expect(new Set(names).size).toBe(names.length);
  });
});
