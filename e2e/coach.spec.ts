import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { addDays } from "../src/lib/activities/dates";
import { isoWeekStart, localDate } from "../src/lib/time";
import { signUpAndOnboard } from "./helpers";

config({ path: ".env.local", quiet: true });

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function currentUser(email: string) {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  const id = data.users.find((u) => u.email === email)!.id;
  const { data: profile } = await admin().from("profiles").select("timezone").eq("user_id", id).single();
  return { id, today: localDate(new Date(), profile!.timezone) };
}

const EX = Object.fromEntries(["squat", "rdl", "bench", "row", "press", "plank"].map((k) => [k, randomUUID()]));
const MUSCLES = {
  [EX.squat!]: ["quads", "glutes"],
  [EX.rdl!]: ["hamstrings"],
  [EX.bench!]: ["chest"],
  [EX.row!]: ["back"],
  [EX.press!]: ["shoulders"],
  [EX.plank!]: ["core"],
};
const ex = (key: string, name: string) => ({ exercise_id: EX[key], name, sets: 3, rep_min: 6, rep_max: 10 });
const full = (minutes: number) => ({
  type: "strength",
  title: "Full body",
  focus: "full",
  duration_min: minutes,
  exercises: [ex("squat", "Squat"), ex("rdl", "RDL"), ex("bench", "Bench"), ex("row", "Row"), ex("press", "Press"), ex("plank", "Plank")],
  notes: null,
});
const run = (title: string, run_type: string, km: number | null, minutes: number | null = null, zone = 2) => ({
  type: "run",
  title,
  run_type,
  distance_km: km,
  duration_min: minutes,
  hr_zone: zone,
  pace: null,
  notes: null,
});

/** Inserts a plan for the user's current week; `days` = sessions per weekday (Monday first). */
async function seedPlan(userId: string, weekStart: string, days: unknown[][], status: "draft" | "active" = "draft") {
  const snapshot = {
    weekStart,
    phase: "base",
    history: { avgWeeklyRunKm: 20, easyPaceMinPerKm: 6, weeklyRunKm: [20, 20, 20, 20] },
    preferences: { daysPerWeek: 6, maxSessionMin: 90, longRunWeekday: 7, equipment: "gym" },
    experience: { strength: "intermediate", running: "intermediate" },
    exerciseMuscles: MUSCLES,
  };
  const { data: plan, error } = await admin()
    .from("training_plans")
    .insert({ user_id: userId, local_date: weekStart, week_start: weekStart, phase: "base", context_snapshot: snapshot, status: status === "active" ? "draft" : status })
    .select("id")
    .single();
  if (error) throw error;
  const rows = days.flatMap((sessions, day) =>
    sessions.map((details, position) => ({
      user_id: userId,
      plan_id: plan!.id,
      local_date: addDays(weekStart, day),
      day_index: day,
      position,
      type: (details as { type: string }).type,
      details,
    })),
  );
  await admin().from("planned_sessions").insert(rows);
  if (status === "active") await admin().from("training_plans").update({ status: "active" }).eq("id", plan!.id);
  return plan!.id as string;
}

async function seedAiKey(userId: string) {
  const { encryptSecret } = await import("../src/server/crypto");
  await admin().from("user_ai_keys").insert({ user_id: userId, ...encryptSecret("sk-ant-api03-e2e-coach-key-TEST"), last4: "TEST" });
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

test("Given no preferences, Then no generate action is offered; a past race date is rejected; saving enables generation", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const user = await currentUser(email);
  await seedAiKey(user.id);

  await page.goto("/coach");
  await expect(page.getByRole("heading", { name: "Tell your coach how you train" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate plan" })).toHaveCount(0);

  await page.goto("/coach/preferences");
  await page.getByLabel("Training days per week").selectOption("5");
  await page.getByLabel("Longest session (minutes)").fill("75");
  await page.getByLabel("Target race").selectOption("10k");
  await page.getByLabel("Race date").fill(addDays(user.today, -1));
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("The race date is in the past")).toBeVisible();

  await page.getByLabel("Target race").selectOption("none");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/coach");
  await expect(page.getByRole("button", { name: "Generate plan" })).toBeVisible();
});

test("Given a draft with a warning, Then edits re-validate instantly and accepting needs acknowledgement", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const user = await currentUser(email);
  const week = isoWeekStart(user.today);
  const legs = { ...full(60), title: "Leg day", focus: "legs", exercises: [ex("squat", "Squat"), ex("rdl", "RDL")] };
  await seedPlan(user.id, week, [[full(120)], [run("Easy run", "easy", 6)], [{ type: "core", title: "Core", duration_min: 20, exercises: [], notes: null }], [full(60)], [legs], [{ type: "rest" }], [run("Long run", "long", 6)]]);
  await admin().from("training_preferences").insert({ user_id: user.id, days_per_week: 6, max_session_min: 90, long_run_weekday: 7, equipment: "gym" });

  await page.goto("/coach");
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  const monday = page.getByTestId("planned-session").filter({ hasText: "Full body · 120 min" });
  await expect(monday.getByRole("note")).toContainText("Session length");

  // Accept is blocked until the warning is acknowledged
  await expect(page.getByRole("button", { name: "Accept plan" })).toBeDisabled();

  // Move the long run to Saturday, right after Friday's leg day → instant scheduling warning
  await page.getByRole("button", { name: "Edit Long run" }).click();
  await page.getByRole("dialog").getByLabel("Day", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("list", { name: "Warnings" })).toContainText("Hard days hard, easy days easy");

  await page.getByLabel("I've read the warnings and want to use this plan anyway.").check();
  await page.getByRole("button", { name: "Accept plan" }).click();
  await expect(page.getByText("Active plan")).toBeVisible();

  await page.goto("/coach/history");
  await expect(page.getByRole("list", { name: "Plan history" })).toContainText("Active");
});

test("Given today's planned run, When a run syncs from Apple Health, Then Today shows it completed", async ({ page, request }) => {
  const email = await signUpAndOnboard(page);
  const user = await currentUser(email);
  const week = isoWeekStart(user.today);
  const dayIndex = (new Date(`${user.today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days: unknown[][] = Array.from({ length: 7 }, () => [{ type: "rest" }]);
  days[dayIndex] = [run("Easy run", "easy", 5)];
  await seedPlan(user.id, week, days, "active");

  await page.goto("/today");
  const session = page.getByTestId("today-session");
  await expect(session).toContainText("Easy run");
  await expect(session.getByRole("button", { name: "Mark done" })).toBeVisible();

  const token = await generateToken(page);
  const start = `${user.today}T06:00:00Z`;
  const res = await request.post("/api/ingest/health", {
    headers: { authorization: `Bearer ${token}` },
    data: { workouts: [{ sport: "running", start, end: `${user.today}T06:30:00Z`, duration_s: 1800, distance_m: 5000 }] },
  });
  expect(res.ok()).toBe(true);

  await page.goto("/today");
  await expect(session).toContainText("Done");
  await expect(session).toContainText("Completed automatically from your synced run");
  await session.getByRole("button", { name: "Undo" }).click();
  await expect(session.getByRole("button", { name: "Mark done" })).toBeVisible();
});

test("Given a check-in, Then resubmitting replaces the score and keeping the original is recorded", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const user = await currentUser(email);
  const dayIndex = (new Date(`${user.today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days: unknown[][] = Array.from({ length: 7 }, () => [{ type: "rest" }]);
  days[dayIndex] = [run("Track intervals", "intervals", null, 45, 4)];
  await seedPlan(user.id, isoWeekStart(user.today), days, "active");

  const checkIn = async (values: [number, number, number, number]) => {
    const labels = ["Sleep quality", "Muscle soreness", "Energy", "Stress"];
    for (const [i, label] of labels.entries()) {
      await page.getByRole("group", { name: new RegExp(`^${label}`) }).getByText(String(values[i]), { exact: true }).click();
    }
    await page.getByRole("button", { name: "Check in" }).click();
  };

  await page.goto("/today");
  await checkIn([4, 4, 4, 4]);
  await expect(page.getByTestId("readiness-score")).toContainText("GREEN");

  await page.getByRole("button", { name: "Redo check-in" }).click();
  await checkIn([3, 3, 3, 2]);
  await expect(page.getByTestId("readiness-score")).toContainText("AMBER");
  await expect(page.getByTestId("today-session")).toContainText("Suggested: Easy run (instead of quality)");

  await page.getByRole("button", { name: "Keep original" }).click();
  await expect(page.getByText("You kept the original plan for today.")).toBeVisible();
  await expect(page.getByTestId("today-session")).toContainText("Track intervals");
});

test("Given no AI key, Then the weekly review shows every figure and explains the summary needs a key", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/coach/review");
  await expect(page.getByText("Adherence", { exact: true })).toBeVisible();
  await expect(page.getByText("No accepted plan for this week.")).toBeVisible();
  await expect(page.getByText("Running", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /quads/i })).toBeVisible();
  await expect(page.getByText("The AI coach summary needs your Anthropic API key.")).toBeVisible();
});
