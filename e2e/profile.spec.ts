import { expect, test } from "@playwright/test";
import { newEmail, signIn, signUpAndOnboard } from "./helpers";

test("Given a new user, When onboarding is incomplete, Then app pages redirect to onboarding", async ({ page }) => {
  await signIn(page, newEmail());
  await page.goto("/train");
  await expect(page).toHaveURL(/\/onboarding/);
});

test("Given onboarding, When height is implausible, Then a validation error is shown and nothing is saved", async ({ page }) => {
  await signIn(page, newEmail());
  await page.getByLabel("Display name").fill("Tall");
  await page.getByLabel("Sex").selectOption("female");
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByLabel("Height (cm)").fill("300");
  await page.getByLabel("Strength training experience").selectOption("advanced");
  await page.getByLabel("Running experience").selectOption("none");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/between 100 and 250/)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
});

test("Given a completed profile, When height is edited in Settings, Then the new value persists", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByText(/Hi Test Athlete/)).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Height (cm)").fill("182.5");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Height (cm)")).toHaveValue("182.5");
});

test("Given imperial units, When height is saved as 5 ft 10 in, Then it shows 5 ft 10 in after reload", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/settings");
  // The select only switches the height fields once the form has hydrated; retry until it has.
  await expect(async () => {
    await page.getByLabel("Units").selectOption("imperial");
    await expect(page.getByLabel("Feet")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Feet").fill("5");
  await page.getByLabel("Inches").fill("10");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Feet")).toHaveValue("5");
  await expect(page.getByLabel("Inches")).toHaveValue("10");
});
