import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { encryptSecret } from "../src/server/crypto";
import { signUpAndOnboard } from "./helpers";

config({ path: ".env.local", quiet: true });

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function userId(email: string) {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === email)!.id;
}

const n = (kcal: number, protein_g: number, carb_g: number, fat_g: number) => ({
  kcal,
  protein_g,
  carb_g,
  fat_g,
  fiber_g: null,
  sugar_g: null,
  satfat_g: null,
  sodium_mg: null,
  potassium_mg: null,
  calcium_mg: null,
  iron_mg: null,
  magnesium_mg: null,
  vitamin_d_ug: null,
  b12_ug: null,
});
const rice = n(130, 2.7, 28.2, 0.3);
const chicken = n(165, 31, 0, 3.6);
const pasta = n(158, 5.8, 31, 0.9);

const recognized = {
  kind: "draft",
  draft: {
    source: "photo",
    name: "Chicken and rice",
    photo_path: null,
    items: [
      { name: "White rice", grams: 150, preparation: "boiled", confidence: "medium", quantity_source: "estimated", nutrient_source: "usda", source_ref: "2512381", matched_name: "Rice, white, cooked", per100g: rice, estimate: rice, alternatives: [] },
      { name: "Grilled chicken", grams: 120, preparation: "grilled", confidence: "low", quantity_source: "estimated", nutrient_source: "estimated", source_ref: null, matched_name: null, per100g: chicken, estimate: chicken, alternatives: [] },
    ],
  },
};

const recommendations = {
  kind: "options",
  options: [
    {
      title: "Pasta night",
      totals: { kcal: 1000, protein_g: 70, carb_g: 120, fat_g: 20 },
      meals: [
        { slot: "snack", name: "Rice cakes", totals: { kcal: 200, protein_g: 5, carb_g: 40, fat_g: 1 }, foods: [{ name: "Rice cakes", grams: 50, nutrient_source: "estimated", source_ref: null, matched_name: null, per100g: n(390, 8, 80, 3) }] },
        {
          slot: "dinner",
          name: "Chicken pasta",
          totals: { kcal: 800, protein_g: 65, carb_g: 80, fat_g: 19 },
          foods: [
            { name: "Pasta", grams: 300, nutrient_source: "usda", source_ref: "1", matched_name: "Pasta, cooked", per100g: pasta },
            { name: "Chicken breast", grams: 200, nutrient_source: "estimated", source_ref: null, matched_name: null, per100g: chicken },
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page) {
  const email = await signUpAndOnboard(page);
  const id = await userId(email);
  const today = new Date().toISOString().slice(0, 10);
  await admin().from("body_weights").insert({ user_id: id, local_date: today, occurred_at: new Date().toISOString(), weight_kg: 80 });
  await admin().from("user_ai_keys").insert({ user_id: id, ...encryptSecret("sk-ant-api03-e2e-not-used-KEY1"), last4: "KEY1" });
  return id;
}

/** The AI endpoints are stubbed at the network layer; everything else hits the real server and database.
 * Registered after navigation: WebKit drops the session cookie on page loads made while interception is on. */
async function stubAi(page: Page) {
  await page.route("**/api/meals/recognize", (route) => route.fulfill({ json: recognized }));
  await page.route("**/api/nutrition/recommendations", (route) => route.fulfill({ json: recommendations }));
}

test("snap → confirm with gram edit → totals → recommendations → plan → log planned dinner", async ({ page }) => {
  await setup(page);
  await page.goto("/eat");
  await expect(page.getByTestId("kcal-eaten")).toContainText("0");
  await stubAi(page);

  // Wait until the page is hydrated (a client-side toggle works) before handing it a file.
  await page.getByRole("button", { name: "Describe" }).click();
  await expect(page.getByLabel("Describe your meal")).toBeVisible();

  const photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#c96" } }).jpeg().toBuffer();
  await page.getByLabel("Meal photo").setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: photo });

  const confirm = page.getByRole("region", { name: "Confirm meal" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("Please check this item")).toBeVisible();
  await expect(confirm.getByTestId("draft-totals")).toContainText("Total: 393 kcal");
  await confirm.getByLabel("White rice grams", { exact: true }).fill("220");
  await expect(confirm.getByTestId("draft-totals")).toContainText("Total: 484 kcal");
  await confirm.getByRole("button", { name: "Save meal" }).click();

  await expect(page.getByTestId("meal")).toHaveCount(1);
  await expect(page.getByTestId("kcal-eaten")).toContainText("484");

  await page.getByRole("button", { name: "What should I eat for the rest of today?" }).click();
  await expect(page.getByTestId("suggestion")).toHaveCount(1);
  await page.getByRole("button", { name: "Plan this" }).click();
  const planned = page.getByRole("region", { name: "Planned meals" });
  await expect(planned).toContainText("Chicken pasta");
  // Planned meals don't count until eaten.
  await expect(page.getByTestId("kcal-eaten")).toContainText("484");

  await planned.getByRole("listitem").filter({ hasText: "Chicken pasta" }).getByRole("button", { name: "Ate this" }).click();
  await expect(confirm.getByTestId("draft-item")).toHaveCount(2);
  await expect(confirm.getByLabel("Meal type")).toHaveValue("dinner");
  await confirm.getByRole("button", { name: "Save meal" }).click();

  await expect(page.getByTestId("meal")).toHaveCount(2);
  await expect(planned).not.toContainText("Chicken pasta");
  // 484 + 300 g pasta (474) + 200 g chicken (330)
  await expect(page.getByTestId("kcal-eaten")).toContainText("1,288");
});

test("Given no AI key, Then photo and suggestions are disabled with a link and manual search remains", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const id = await userId(email);
  await admin().from("body_weights").insert({ user_id: id, local_date: new Date().toISOString().slice(0, 10), occurred_at: new Date().toISOString(), weight_kg: 80 });
  await page.goto("/eat");
  await expect(page.getByText("Photo logging needs your Anthropic API key")).toBeVisible();
  await expect(page.getByText("Meal suggestions needs your Anthropic API key")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search food" })).toBeEnabled();
});

test("Given a lifestyle change in Settings, Then today's calorie target updates", async ({ page }) => {
  await setup(page);
  await page.goto("/eat");
  const before = await page.getByTestId("kcal-eaten").textContent();
  await page.goto("/settings");
  await page.getByLabel("Activity outside workouts").selectOption("active");
  await page.getByRole("button", { name: "Save nutrition preferences" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.goto("/eat");
  await expect(page.getByTestId("kcal-eaten")).not.toHaveText(before!);
  await page.getByRole("button", { name: "Why this number?" }).click();
  await expect(page.getByText("active (1.5)")).toBeVisible();
});
