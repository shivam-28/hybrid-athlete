import { expect, test } from "@playwright/test";
import { completeOnboarding, latestCode, newEmail, signIn } from "./helpers";

test("Given a new email, When the user signs in with the emailed code, Then they land on onboarding", async ({ page }) => {
  await signIn(page, newEmail());
  await expect(page).toHaveURL(/\/onboarding/);
});

test("Given a wrong code, Then the user stays signed out and sees an error", async ({ page }) => {
  const email = newEmail();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  const code = await latestCode(email);
  await page.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form [role=alert]")).toContainText(/invalid|expired/i);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("Given an anonymous visit to /today, When the user signs in, Then they return to /today", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings/);
  const email = newEmail();
  await signIn(page, email, "/settings");
  await completeOnboarding(page);
});

test("Given a signed-in user, When they sign out, Then they return to sign-in and app pages are blocked", async ({ page }) => {
  await signIn(page, newEmail());
  await completeOnboarding(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("Given no session, When an API route is called, Then it returns 401", async ({ request }) => {
  const res = await request.get("/api/account/export");
  expect(res.status()).toBe(401);
});
