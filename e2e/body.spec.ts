import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { encryptSecret } from "../src/server/crypto";
import { signUpAndOnboard } from "./helpers";

config({ path: ".env.local", quiet: true });

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function userId(email: string) {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === email)!.id;
}

test("Given a new user, When they log a weight, Then it appears in the history, the chart and the trend", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/body");
  await expect(page.getByTestId("trend-weight")).toHaveText("—");

  await page.getByLabel("Weight (kg)").fill("78.4");
  await page.getByRole("button", { name: "Log" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Weight saved" })).toBeVisible();

  await expect(page.getByTestId("trend-weight")).toHaveText("78.4 kg");
  await expect(page.getByTestId("weight-chart")).toHaveAttribute("data-points", "1");
  await expect(page.getByRole("list", { name: "Manual weigh-ins" })).toContainText("78.4 kg");
  await expect(page.getByTestId("weekly-rate")).toHaveText("Not enough data");
});

test("Given 14 days of weights and two waist measurements, Then rate and waist change are shown", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const id = await userId(email);
  const today = new Date();
  const rows = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    return { user_id: id, local_date: date, occurred_at: `${date}T06:00:00Z`, weight_kg: 80 - i * 0.1 };
  });
  await admin().from("body_weights").insert(rows);
  await admin().from("body_measurements").insert([
    { user_id: id, local_date: rows[0]!.local_date, occurred_at: rows[0]!.occurred_at, waist_cm: 88 },
    { user_id: id, local_date: rows[13]!.local_date, occurred_at: rows[13]!.occurred_at, waist_cm: 86.5 },
  ]);

  await page.goto("/body");
  await expect(page.getByTestId("weekly-rate")).toContainText("kg/week");
  await expect(page.getByTestId("waist-change")).toContainText("Waist −1.5 cm");
  await page.getByRole("radio", { name: "12w" }).click();
  await expect(page.getByRole("radio", { name: "12w" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("weight-chart")).toHaveAttribute("data-points", "14");
});

async function gpsJpeg(width = 60, height = 40) {
  return sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "Apple", Model: "iPhone 17 Pro" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "55/1 40/1 0/1" } })
    .toBuffer();
}

async function giveAiKey(email: string) {
  await admin().from("user_ai_keys").insert({ user_id: await userId(email), ...encryptSecret("sk-ant-api03-e2e-body-KEY1"), last4: "KEY1" });
}

test("Given an uploaded report with a misread value, When the user corrects 81.5 → 18.5 and confirms, Then 18.5 % is saved and the stored image has no EXIF", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await giveAiKey(email);
  // The Claude call itself is unit-tested with a mocked client; here the route's response is stubbed at the network boundary.
  await page.route("**/api/body-composition/extract", (route) =>
    route.fulfill({
      json: {
        kind: "draft",
        draft: { method: "inbody", test_date: "2026-10-01", unit: "kg", weight: 80, body_fat_pct: 81.5, fat_mass: null, lean_mass: null, skeletal_muscle: 36.1, visceral_fat_level: null, bmr_kcal: null, total_body_water: null, segmental_lean: null },
        notFound: ["fat_mass", "lean_mass", "visceral_fat_level", "bmr_kcal", "total_body_water"],
        warnings: [],
      },
    }),
  );

  await page.goto("/body/composition/new");
  await page.getByLabel("Upload a report (photo or PDF)").setInputFiles({ name: "inbody.jpg", mimeType: "image/jpeg", buffer: await gpsJpeg() });
  await expect(page.getByLabel("Body fat (%)")).toHaveValue("81.5");
  await expect(page.getByRole("alert", { name: "Consistency warnings" })).toContainText("outside the usual 3–60 %");
  await expect(page.getByText("Not found on the report").first()).toBeVisible();

  await page.getByLabel("Body fat (%)").fill("18.5");
  await expect(page.getByRole("alert", { name: "Consistency warnings" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page).toHaveURL(/\/body\/composition$/);
  await expect(page.getByRole("region", { name: "Tests" })).toContainText("18.5 % body fat");

  const { data: rows } = await admin().from("body_composition_tests").select("document_path, body_fat_pct").eq("user_id", await userId(email));
  expect(rows).toHaveLength(1);
  expect(Number(rows![0]!.body_fat_pct)).toBe(18.5);
  const stored = await admin().storage.from("body-comp-docs").download(rows![0]!.document_path!);
  const meta = await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata();
  expect(meta.exif).toBeUndefined();
});

test("Given no AI key, When a report is uploaded, Then it is stored and an empty manual form is shown", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/body/composition/new");
  await expect(page.getByText("needs your AI key").first()).toBeVisible();
  await page.getByLabel("Upload a report (photo or PDF)").setInputFiles({ name: "report.jpg", mimeType: "image/jpeg", buffer: await gpsJpeg() });
  await expect(page.getByRole("status").filter({ hasText: "Your file is saved" })).toBeVisible();
  await expect(page.getByLabel("Body fat (%)")).toHaveValue("");
  await page.getByLabel("Method").selectOption("dexa");
  await page.getByLabel("Weight (kg)").fill("79");
  await page.getByLabel("Body fat (%)").fill("18.5");
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("region", { name: "Tests" })).toContainText("18.5 % body fat");
  await expect(page.getByRole("region", { name: "Tests" })).toContainText("DEXA");
});

test("Given a .docx file, When uploaded as a report, Then it is rejected with the allowed types", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/body/composition/new");
  await page.getByLabel("Upload a report (photo or PDF)").setInputFiles({ name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK") });
  await expect(page.getByRole("alert").filter({ hasText: "JPEG, PNG or HEIC image, or a PDF, up to 10 MB" })).toBeVisible();
});

async function uploadPhoto(page: import("@playwright/test").Page, date: string, pose: "Front" | "Side" | "Back") {
  const photos = page.getByRole("img", { name: / photo, / });
  const before = await photos.count();
  await page.getByRole("radio", { name: pose }).click();
  await expect(page.getByRole("radio", { name: pose })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: await gpsJpeg(120, 160) });
  await page.getByRole("button", { name: "Save photo" }).click();
  await expect(photos).toHaveCount(before + 1);
}

test("Given front photos from 2026-08-01 and 2026-10-01, When compared, Then they show side by side 61 days apart without EXIF", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await page.goto("/body/photos");
  await uploadPhoto(page, "2026-08-01", "Front");
  await uploadPhoto(page, "2026-10-01", "Front");
  await expect(page.getByRole("region", { name: "1 Aug 2026" })).toBeVisible();

  const { data: rows } = await admin().from("progress_photos").select("storage_path").eq("user_id", await userId(email));
  expect(rows).toHaveLength(2);
  const stored = await admin().storage.from("progress-photos").download(rows![0]!.storage_path);
  expect((await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata()).exif).toBeUndefined();

  await page.getByRole("link", { name: "Compare photos" }).click();
  await expect(page.getByTestId("days-apart")).toHaveText("61 days apart");
  await expect(page.getByRole("img", { name: /Earlier: 1 Aug 2026/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Later: 1 Oct 2026/ })).toBeVisible();
  await expect(page.getByText("AI photo analysis is off")).toBeVisible();
});

test("Given consent and a stubbed analysis, Then observations show and a body fat range carries the visual-impression label", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await giveAiKey(email);
  await page.goto("/body/photos");
  await uploadPhoto(page, "2026-08-01", "Front");
  await uploadPhoto(page, "2026-10-01", "Front");

  await page.goto("/settings#photo-ai");
  await page.getByRole("button", { name: "I agree, turn on AI photo analysis" }).click();
  await expect(page.getByRole("button", { name: "Turn off AI photo analysis" })).toBeVisible();

  await page.route("**/api/progress-photos/analyze", (route) =>
    route.fulfill({ json: { id: "x", observations: ["Waist looks narrower."], visualImpression: "Roughly 15–17 %" } }),
  );
  await page.goto("/body/photos/compare?a=2026-08-01&b=2026-10-01&pose=front");
  await page.getByRole("button", { name: "Describe what changed" }).click();
  await expect(page.getByText("Waist looks narrower.")).toBeVisible();
  await expect(page.getByText("Visual impression, not a measurement:")).toBeVisible();
});

test("Given a photo without a pose, Then the upload asks for a pose", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/body/photos");
  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await gpsJpeg() });
  await page.getByRole("button", { name: "Save photo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose a pose" })).toBeVisible();
});

async function seedSteadyWeight(email: string, kg: number, days = 15) {
  const id = await userId(email);
  const rows = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { user_id: id, local_date: date, occurred_at: `${date}T06:00:00Z`, weight_kg: kg };
  });
  await admin().from("body_weights").insert(rows);
}

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("Given trend 80 kg and a goal of 72 kg in 6 weeks, Then a warning proposes the 10-week safe date, and accepting it clears the warning", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await seedSteadyWeight(email, 80);
  await page.goto("/body/goal");
  await page.getByLabel("Goal weight (kg)").fill("72");
  await page.getByLabel("Target date (optional)").fill(isoInDays(42));
  await page.getByRole("button", { name: "Save goal" }).click();

  await expect(page.getByTestId("goal-phase")).toHaveText("Cut");
  const warnings = page.getByRole("alert", { name: "Goal warnings" });
  await expect(warnings).toContainText("needs a faster rate than is safe");
  const safe = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoInDays(70)}T00:00:00Z`));
  await expect(warnings).toContainText(safe);
  await expect(page.getByTestId("goal-timeline")).toContainText("−0.80 kg/week");

  await warnings.getByRole("button", { name: `Use ${safe}` }).click();
  await expect(page.getByRole("alert", { name: "Goal warnings" })).toHaveCount(0);
  await expect(page.getByTestId("goal-timeline")).toContainText("about 10 weeks");
  await expect(page.getByText("Goal history")).toBeVisible();
});

test("Given a goal but no weight, Then the goal view asks for a weight", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/body/goal");
  await page.getByLabel("Goal weight (kg)").fill("76");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByRole("link", { name: "Log a weight" })).toBeVisible();
});

test("Given a seeded user with weights and a cut goal, Then Today shows trend, weekly rate and goal progress", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  const id = await userId(email);
  const rows = Array.from({ length: 15 }, (_, i) => {
    const date = new Date(Date.now() - (14 - i) * 86_400_000).toISOString().slice(0, 10);
    return { user_id: id, local_date: date, occurred_at: `${date}T06:00:00Z`, weight_kg: 80 - i * 0.07 };
  });
  await admin().from("body_weights").insert(rows);
  await admin().from("body_goals").insert({ user_id: id, local_date: rows[0]!.local_date, occurred_at: rows[0]!.occurred_at, goal_weight_kg: 76 });

  await page.goto("/today");
  const card = page.getByRole("link", { name: "Body summary" });
  await expect(card).toContainText(/Trend 79\.\d kg/);
  await expect(card).toContainText("kg/week");
  await expect(card).toContainText("Cut → 76 kg");
  await expect(card).toContainText("ETA about");
});
