import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_PAYLOAD } from "../src/lib/ingest/example";
import { localDate } from "../src/lib/time";
import { signUpAndOnboard } from "./helpers";

const FIXTURES = "tests/fixtures/fit";

async function uploadFit(page: Page, name: string) {
  await page.goto("/train/activities");
  await page.getByLabel("FIT or Garmin export file").setInputFiles(`${FIXTURES}/${name}`);
}

async function generateToken(page: Page): Promise<string> {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Generate token" }).click();
  const field = page.getByLabel("New ingest token");
  await expect(field).toHaveValue(/^ha_/);
  const token = await field.inputValue();
  await page.getByRole("button", { name: "Done" }).click();
  return token;
}

test("Given a FIT file, When uploaded, Then the user lands on its detail page with splits and zones", async ({ page }) => {
  await signUpAndOnboard(page);
  await uploadFit(page, "run-5_4k.fit");
  await expect(page).toHaveURL(/\/train\/activities\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Run" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Splits" }).getByRole("row")).toHaveCount(7);
  await expect(page.getByRole("table", { name: "Time in heart-rate zones" })).toBeVisible();
  await expect(page.getByText("estimated from age")).toBeVisible();

  await uploadFit(page, "run-5_4k.fit");
  await expect(page.getByRole("alert").filter({ hasText: "already been imported" })).toBeVisible();
  await page.getByRole("link", { name: "Open the existing activity" }).click();
  await expect(page).toHaveURL(/\/train\/activities\/[0-9a-f-]{36}$/);

  await uploadFit(page, "corrupt.fit");
  await expect(page.getByRole("alert").filter({ hasText: "could not be read as a FIT activity" })).toBeVisible();
});

test("Ingest twice, then upload the matching FIT: one merged activity; deleting it clears list and weekly totals", async ({ page, request }) => {
  await signUpAndOnboard(page);
  const token = await generateToken(page);
  const post = () =>
    request.post("/api/ingest/health", { headers: { authorization: `Bearer ${token}` }, data: EXAMPLE_PAYLOAD });

  const first = await post();
  expect(first.status()).toBe(200);
  // three entries share one date: the first inserts the day, the next two merge into it
  expect(await first.json()).toEqual({ inserted: 2, updated: 2, unchanged: 0 });
  expect(await (await post()).json()).toEqual({ inserted: 0, updated: 0, unchanged: 4 });

  await page.goto("/settings");
  await expect(page.getByText("0 new, 0 updated, 4 unchanged")).toBeVisible();

  await uploadFit(page, "run-10k-hr.fit");
  await expect(page).toHaveURL(/\/train\/activities\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Sources")).toContainText("Apple Health");
  await expect(page.getByLabel("Sources")).toContainText("FIT file");

  await page.goto("/train/activities");
  await expect(page.getByRole("list", { name: "Activities" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "Run", exact: true }).click();
  await expect(page).toHaveURL(/\/train\/activities\?sport=running/);
  await expect(page.getByRole("list", { name: "Activities" }).getByRole("listitem")).toHaveCount(1);

  await page.getByRole("list", { name: "Activities" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Delete activity" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/train\/activities$/);
  await expect(page.getByText("No activities yet")).toBeVisible();
  await page.getByText("Weekly table").click();
  await expect(page.getByRole("table", { name: "Weekly running summary" })).not.toContainText("10.0 km");

  const today = localDate(new Date(), "Europe/Copenhagen");
  await request.post("/api/ingest/health", { headers: { authorization: `Bearer ${token}` }, data: { daily: [{ date: today, steps: 8234 }] } });
  await page.goto("/train/recovery");
  await expect(page.getByRole("table", { name: "Daily metrics" })).toContainText("8,234");
  await expect(page.getByRole("table", { name: "Daily metrics" })).toContainText("not available");
});

test("Given an invalid max HR, Then it is rejected; a valid one recalculates activity zones", async ({ page }) => {
  await signUpAndOnboard(page);
  await uploadFit(page, "run-5_4k.fit");
  await expect(page.getByText("estimated from age")).toBeVisible();
  const detail = page.url();

  await page.goto("/settings");
  await page.getByLabel("Max heart rate (bpm, optional)").fill("99");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText(/between 100 and 230/)).toBeVisible();

  await page.getByLabel("Max heart rate (bpm, optional)").fill("150");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.goto(detail);
  await expect(page.getByText("Max HR 150 bpm, from your profile")).toBeVisible();
});

test("Given no token, Then the setup guide asks the user to generate one and shows the instance URL", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/settings/apple-health");
  await expect(page.getByRole("alert").filter({ hasText: "You need an ingest token first" })).toBeVisible();
  await expect(page.getByLabel("Ingest URL")).toHaveText(/^http:\/\/localhost:3000\/api\/ingest\/health$/);
  await expect(page.getByLabel("Test command")).toContainText("curl -X POST");
});
