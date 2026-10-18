import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { deleteAccount } from "../account/delete";
import { buildExport } from "../account/export";

let a: TestUser;
let b: TestUser;
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const day = { local_date: "2026-10-01" };

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) {
    await u.client.from("profiles").insert(sampleProfile);
    await u.client.storage.from("meal-photos").upload(`${u.id}/meal.jpg`, jpeg());
    const { data: meal } = await u.client
      .from("meals")
      .insert({ ...day, occurred_at: "2026-10-01T11:00:00Z", meal_type: "lunch", source: "photo", photo_path: `${u.id}/meal.jpg` })
      .select("id")
      .single();
    await u.client.from("meal_items").insert({
      meal_id: meal!.id,
      position: 0,
      name: "Rice",
      grams: 100,
      quantity_source: "estimated",
      nutrient_source: "estimated",
      per100g: {},
      kcal: 130,
      protein_g: 3,
      carb_g: 28,
      fat_g: 0.3,
    });
    await u.client.from("food_log_days").insert({ ...day, is_complete: true });
    await u.client.from("daily_nutrition_targets").insert({ ...day, targets: {}, components: [], method: "formula" });
    await u.client.from("planned_meals").insert({ ...day, slot: "dinner", name: "Pasta", items: [] });
  }
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("nutrition data in account export/delete", () => {
  it("Given A has meals with a photo, When A exports, Then the rows and the photo are included", async () => {
    const result = await buildExport(a.client, a.id);
    for (const table of ["meals", "meal_items", "food_log_days", "daily_nutrition_targets", "planned_meals"]) {
      expect(result.tables[table]).toHaveLength(1);
    }
    expect(result.files.filter((f) => f.bucket === "meal-photos").map((f) => f.path)).toEqual([`${a.id}/meal.jpg`]);
  });

  it("When A deletes the account, Then A's nutrition rows and photos are gone and B's remain", async () => {
    await deleteAccount(a.id);
    const admin = adminClient();
    for (const table of ["meals", "meal_items", "food_log_days", "daily_nutrition_targets", "planned_meals"] as const) {
      expect((await admin.from(table).select("id").eq("user_id", a.id)).data).toEqual([]);
      expect((await admin.from(table).select("id").eq("user_id", b.id)).data).toHaveLength(1);
    }
    expect((await admin.storage.from("meal-photos").list(a.id)).data).toEqual([]);
    expect((await admin.storage.from("meal-photos").list(b.id)).data).toHaveLength(1);
  });
});
