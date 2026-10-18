import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

export const newEmail = (prefix = "e2e") => `${prefix}-${randomUUID().slice(0, 8)}@test.local`;

export async function latestCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages: { ID: string }[] };
    const id = body.messages[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string };
      const code = msg.Text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code delivered to ${email}`);
}

export async function signIn(page: Page, email: string, next = "/today") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  // WebKit hydrates later than Chromium; a click before hydration loses the handler.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  await page.getByLabel("6-digit code").fill(await latestCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function completeOnboarding(page: Page, name = "Test Athlete") {
  await expect(page).toHaveURL(/\/onboarding/);
  // Let the post-sign-in refresh settle so it can't land after onboarding completes.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Sex").selectOption("male");
  await page.getByLabel("Date of birth").fill("1995-06-01");
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByLabel("Strength training experience").selectOption("beginner");
  await page.getByLabel("Running experience").selectOption("beginner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/today/);
  // The greeting only renders once the profile exists server-side.
  await expect(page.getByText(`Hi ${name}`)).toBeVisible();
}

export async function signUpAndOnboard(page: Page) {
  const email = newEmail();
  await signIn(page, email);
  await completeOnboarding(page);
  return email;
}
