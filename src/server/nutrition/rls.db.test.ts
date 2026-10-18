import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;
const ids: Record<string, string> = {};
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const day = { local_date: "2026-10-01" };

async function insertOne(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table as never).insert(row as never).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  for (const u of [a, b]) await u.client.from("profiles").insert(sampleProfile);
  ids.meals = await insertOne(a, "meals", { ...day, occurred_at: "2026-10-01T11:00:00Z", meal_type: "lunch", source: "search", name: "Lunch" });
  ids.meal_items = await insertOne(a, "meal_items", {
    meal_id: ids.meals,
    position: 0,
    name: "Rice",
    grams: 150,
    quantity_source: "estimated",
    nutrient_source: "estimated",
    per100g: { kcal: 130 },
    kcal: 195,
    protein_g: 4,
    carb_g: 42,
    fat_g: 0.4,
  });
  ids.food_log_days = await insertOne(a, "food_log_days", { ...day, is_complete: true });
  ids.daily_nutrition_targets = await insertOne(a, "daily_nutrition_targets", { ...day, targets: {}, components: [], method: "formula" });
  ids.planned_meals = await insertOne(a, "planned_meals", { ...day, slot: "dinner", name: "Pasta", items: [] });
  const { error } = await a.client.storage.from("meal-photos").upload(`${a.id}/own.jpg`, jpeg());
  if (error) throw error;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const TABLES = ["meals", "meal_items", "food_log_days", "daily_nutrition_targets", "planned_meals"] as const;

describe("nutrition data isolation", () => {
  it.each(TABLES)("Given A has %s rows, When B selects them, Then nothing is returned", async (table) => {
    const { data, error } = await b.client.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await a.client.from(table).select("*")).data?.length).toBeGreaterThan(0);
  });

  it.each(TABLES)("When B updates or deletes A's %s row, Then nothing changes", async (table) => {
    await b.client.from(table).update({ updated_at: "2020-01-01T00:00:00Z" }).eq("id", ids[table]!);
    await b.client.from(table).delete().eq("id", ids[table]!);
    const { data } = await a.client.from(table).select("updated_at").eq("id", ids[table]!).single();
    expect(data?.updated_at).not.toBe("2020-01-01T00:00:00+00:00");
  });

  it("When B inserts a meal owned by A, Then the write is rejected", async () => {
    const { error } = await b.client
      .from("meals")
      .insert({ user_id: a.id, ...day, occurred_at: "2026-10-01T11:00:00Z", meal_type: "lunch", source: "search" });
    expect(error).not.toBeNull();
  });

  it("When B attaches an item to A's meal, Then the write is rejected", async () => {
    const { error } = await b.client.from("meal_items").insert({
      meal_id: ids.meals!,
      position: 1,
      name: "x",
      grams: 1,
      quantity_source: "user",
      nutrient_source: "estimated",
      per100g: {},
      kcal: 0,
      protein_g: 0,
      carb_g: 0,
      fat_g: 0,
    });
    expect(error).not.toBeNull();
  });

  it("When B lists, downloads, uploads to or deletes A's meal photos, Then all are denied", async () => {
    expect((await b.client.storage.from("meal-photos").list(a.id)).data).toEqual([]);
    expect((await b.client.storage.from("meal-photos").download(`${a.id}/own.jpg`)).data).toBeNull();
    expect((await b.client.storage.from("meal-photos").upload(`${a.id}/evil.jpg`, jpeg())).error).not.toBeNull();
    await b.client.storage.from("meal-photos").remove([`${a.id}/own.jpg`]);
    expect((await a.client.storage.from("meal-photos").download(`${a.id}/own.jpg`)).data).not.toBeNull();
  });

  it("When any client reads food_lookup_cache, Then nothing is returned and writes fail", async () => {
    expect((await a.client.from("food_lookup_cache").select("*")).data ?? []).toEqual([]);
    expect((await anonClient().from("food_lookup_cache").select("*")).data ?? []).toEqual([]);
    const { error } = await a.client
      .from("food_lookup_cache")
      .insert({ source: "usda", query_normalized: "poison", payload: [] });
    expect(error).not.toBeNull();
  });

  it("When anon reads nutrition tables, Then nothing is returned", async () => {
    for (const table of TABLES) expect((await anonClient().from(table).select("*")).data ?? []).toEqual([]);
  });

  it("gives profiles nutrition defaults", async () => {
    const { data } = await a.client.from("profiles").select("lifestyle_level, diet_type, allergies, dislikes, cuisines").single();
    expect(data).toEqual({ lifestyle_level: "sedentary", diet_type: "omnivore", allergies: [], dislikes: [], cuisines: [] });
  });
});
