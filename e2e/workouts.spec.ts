import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test.describe.configure({ mode: "serial" });

const WORKOUT_ROUTES: [string, string][] = [
  ["GET", "/api/exercises?q=squat"],
  ["POST", "/api/exercises"],
  ["GET", "/api/exercises/00000000-0000-4000-8000-000000000000"],
  ["GET", "/api/exercises/00000000-0000-4000-8000-000000000000/context"],
  ["PUT", "/api/exercises/00000000-0000-4000-8000-000000000000/settings"],
  ["POST", "/api/workouts/sessions"],
  ["POST", "/api/workouts/sessions/00000000-0000-4000-8000-000000000000/finish"],
  ["POST", "/api/workouts/sets"],
  ["POST", "/api/workouts/sets/repeat"],
  ["PATCH", "/api/workouts/sets/00000000-0000-4000-8000-000000000000"],
  ["DELETE", "/api/workouts/sets/00000000-0000-4000-8000-000000000000"],
  ["POST", "/api/workouts/voice"],
  ["POST", "/api/workouts/voice/confirm"],
  ["DELETE", "/api/workouts/aliases/00000000-0000-4000-8000-000000000000"],
];

test("Given no session, When any workout route is called, Then it returns 401", async ({ request }) => {
  for (const [method, path] of WORKOUT_ROUTES) {
    const res = await request.fetch(path, { method, data: method === "GET" ? undefined : {} });
    expect(res.status(), `${method} ${path}`).toBe(401);
  }
});

test("Exercise library: typo search, filters, detail", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/train/exercises");
  await page.getByLabel("Search exercises").fill("dumbel shoulder pres");
  const results = page.getByRole("list", { name: "Exercises" }).getByRole("link");
  await expect(results.filter({ hasText: /^Dumbbell Shoulder Press/ })).toBeVisible();

  await page.getByLabel("Search exercises").fill("");
  await page.getByLabel("Muscle group").selectOption("shoulders");
  await page.getByLabel("Equipment").selectOption("dumbbell");
  await expect(results.filter({ hasNotText: /dumbbell/ })).toHaveCount(0);
  await expect(results.first()).toContainText(/Shoulders.*dumbbell/);

  await page.getByLabel("Search exercises").fill("zzzz qqqq");
  await expect(page.getByRole("link", { name: /Create “zzzz qqqq”/ })).toBeVisible();

  await page.getByLabel("Search exercises").fill("dumbbell shoulder press");
  await page.getByLabel("Muscle group").selectOption("");
  await page.getByLabel("Equipment").selectOption("");
  await results.filter({ hasText: /^Dumbbell Shoulder Press/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Dumbbell Shoulder Press" })).toBeVisible();
  await expect(page.getByText("How to", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Dumbbell Shoulder Press, position 1/ })).toBeVisible();
  await expect(page.locator("dl")).toContainText(/Primary\s*Shoulders/);
});

async function addExercise(page: Page, query: string, name: string | RegExp) {
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill(query);
  await page.getByRole("dialog").getByRole("button", { name }).first().click();
}

function block(page: Page, name: string) {
  return page.locator("[data-slot=card]").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test("Logs a 3-exercise session with a plank and a pull-up, edits, finishes and shows history", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/train");
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();

  await addExercise(page, "barbell squat", /^Barbell Squat\b/);
  const squat = block(page, "Barbell Squat");
  await expect(squat.getByTestId("suggestion")).toContainText(/Baseline/);
  await squat.getByLabel("Weight (kg)").fill("60");
  await squat.getByLabel("Reps").fill("8");
  await squat.getByRole("button", { name: "Log set" }).click();
  await expect(squat.getByRole("list", { name: "Barbell Squat sets" })).toContainText("60 kg × 8");
  await expect(page.getByText(/Session in progress/)).toBeVisible();
  await squat.getByRole("button", { name: "Repeat last set" }).click();
  await expect(squat.getByRole("listitem")).toHaveCount(2);

  await addExercise(page, "plank", /^Plank\b/);
  const plank = block(page, "Plank");
  await plank.getByRole("button", { name: "Log set" }).click();
  await expect(page.getByText(/Duration is required/)).toBeVisible();
  await plank.getByLabel("Duration (seconds)").fill("60");
  await plank.getByRole("button", { name: "Log set" }).click();
  await expect(plank.getByRole("list", { name: "Plank sets" })).toContainText("1:00");

  await addExercise(page, "pullup", /^Pullups\b/);
  const pullups = block(page, "Pullups");
  await pullups.getByLabel("Reps").fill("8");
  await pullups.getByRole("button", { name: "Log set" }).click();
  await expect(pullups.getByRole("list", { name: "Pullups sets" })).toContainText("BW × 8");

  // Edit set 2 of squat, then delete it
  await squat.getByRole("button", { name: "Edit set 2" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reps").fill("6");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(squat.getByRole("list", { name: "Barbell Squat sets" })).toContainText("60 kg × 6");
  await squat.getByRole("button", { name: "Edit set 2" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete set" }).click();
  await expect(squat.getByRole("list", { name: "Barbell Squat sets" }).getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();

  await page.goto("/train/history");
  await expect(page.getByRole("list", { name: "Sessions" })).toContainText("3 exercises · 3 working sets");
  await page.getByRole("list", { name: "Sessions" }).getByRole("link").first().click();
  await expect(page.getByText("Pullups")).toBeVisible();

  await page.goto("/today");
  await expect(page.getByRole("link", { name: "Today's workout" })).toContainText("Workout done");

  // Next session shows last time and a progression target
  await page.goto("/train");
  await addExercise(page, "barbell squat", /^Barbell Squat\b/);
  await expect(block(page, "Barbell Squat").getByTestId("suggestion")).toContainText("60 kg × 8");
  await expect(block(page, "Barbell Squat").getByTestId("suggestion")).toContainText("Today:");
});

test("Text logging: ambiguous → confirm → alias → auto-save on repeat → undo; alias deletion restores fuzzy matching", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/train");
  const voice = page.getByLabel("Say or type a set");

  await voice.fill("shoulder bench press 1st set 12 kg 15 reps done");
  await page.getByRole("button", { name: "Log it" }).click();
  const card = page.getByRole("region", { name: "Confirm set" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Heard: “shoulder bench press 1st set 12 kg 15 reps done”");
  await card.getByRole("button", { name: "Choose a different exercise" }).click();
  await page.getByRole("dialog").getByLabel("Search exercises").fill("dumbbell shoulder press");
  await page.getByRole("dialog").getByRole("button", { name: /^Dumbbell Shoulder Press\b/ }).first().click();
  await expect(card.getByLabel("Reps")).toHaveValue("15");
  await card.getByRole("button", { name: "Save set" }).click();
  await expect(card).toBeHidden();
  await expect(page.getByText(/Dumbbell Shoulder Press — set 1: 12 kg × 15/)).toBeVisible();

  await voice.fill("shoulder bench press 14 kg 10 reps");
  await page.getByRole("button", { name: "Log it" }).click();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: /Dumbbell Shoulder Press — set 2: 14 kg × 10/ });
  await expect(toast).toBeVisible();
  await expect(card).toBeHidden();
  await toast.getByRole("button", { name: "Undo" }).click();
  const sets = page.getByRole("list", { name: "Dumbbell Shoulder Press sets" });
  await expect(sets.getByRole("listitem")).toHaveCount(1);

  await voice.fill("same again");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(sets.getByRole("listitem")).toHaveCount(2);

  await page.goto("/settings");
  const aliases = page.getByRole("list", { name: "Voice aliases" });
  await expect(aliases).toContainText("“shoulder bench press” → Dumbbell Shoulder Press");
  await aliases.getByRole("button", { name: "Delete alias shoulder bench press" }).click();
  await expect(page.getByText(/confirm what a spoken phrase meant/)).toBeVisible();

  await page.goto("/train");
  await page.getByLabel("Say or type a set").fill("shoulder bench press 14 kg 10 reps");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("region", { name: "Confirm set" })).toBeVisible();
});
