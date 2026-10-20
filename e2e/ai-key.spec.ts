import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

config({ path: ".env.local", quiet: true });

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

async function userId(email: string) {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === email)!.id;
}

test("Given a key Anthropic will not accept, When saved, Then nothing is stored and an error is shown", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await page.goto("/settings");
  await page.getByLabel("Anthropic API key").fill("sk-ant-api03-definitely-not-a-real-key");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.locator("form [role=alert]")).toContainText(/rejected|couldn't reach/i);
  const { data } = await admin().from("user_ai_keys").select("user_id").eq("user_id", await userId(email));
  expect(data).toEqual([]);
});

test("Given a stored key, Then Settings shows only the last 4 characters and the page never contains the key", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const fullKey = "sk-ant-api03-e2e-secret-value-LAST";
  // Seed through the same encryption path the app uses, skipping the live Anthropic check.
  const { encryptSecret } = await import("../src/server/crypto");
  await admin().from("user_ai_keys").insert({ user_id: await userId(email), ...encryptSecret(fullKey), last4: "LAST" });

  await page.goto("/settings");
  await expect(page.getByText("••••LAST")).toBeVisible();
  expect(await page.content()).not.toContain(fullKey);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("••••LAST")).toHaveCount(0);
});

test("Given Microsoft Foundry is chosen, Then its fields and billing notice appear, and a disallowed endpoint stores nothing", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await page.goto("/settings");
  await page.getByLabel("Provider").selectOption("foundry");
  await expect(page.getByRole("note")).toContainText(/your own Azure subscription/i);
  await expect(page.getByLabel("Foundry endpoint")).toBeVisible();

  await page.getByLabel("Foundry endpoint").fill("https://my-res.services.ai.azure.com.evil.com/anthropic");
  await page.getByLabel("Foundry API key").fill("FoundryKey0123456789abcdef");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.locator("form [role=alert]")).toContainText(/services\.ai\.azure\.com\/anthropic/);
  const { data } = await admin().from("user_ai_keys").select("user_id").eq("user_id", await userId(email));
  expect(data).toEqual([]);
});
