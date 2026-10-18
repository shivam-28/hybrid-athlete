import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signIn, signUpAndOnboard } from "./helpers";

test("Given a user with a profile, When they download their data, Then the JSON contains their profile", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my data" }).click()]);
  const json = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(json.schema_version).toBe(1);
  expect(json.tables.profiles[0].display_name).toBe("Test Athlete");
});

test("Given the delete dialog, When the user cancels, Then nothing is deleted", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(page.getByRole("button", { name: "Permanently delete" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/today");
  await expect(page.getByText(/Hi Test Athlete/)).toBeVisible();
});

test("Given confirmed deletion, Then the user is signed out and signing in again starts an empty account", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  // Supabase throttles OTP emails per address (1 s)
  await page.waitForTimeout(1100);
  await signIn(page, email);
  await completeOnboarding(page);
});
