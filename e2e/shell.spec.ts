import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test("serves an installable standalone manifest", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/apple-touch-icon.png")).ok()).toBe(true);
});

test("Given a signed-in user, Then the right navigation renders for the viewport and highlights the active tab", async ({ page, isMobile }) => {
  await signUpAndOnboard(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toHaveCount(1);
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");

  for (const section of ["Train", "Eat", "Body", "Coach"]) {
    await nav.getByRole("link", { name: section }).click();
    await expect(page).toHaveURL(new RegExp(`/${section.toLowerCase()}$`));
    await expect(nav.getByRole("link", { name: section })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: section })).toBeVisible();
  }

  const box = await nav.boundingBox();
  const viewport = page.viewportSize()!;
  if (isMobile) expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 5);
  else expect(box!.x).toBeLessThan(5);
});

test("Given a new user, Then Today shows getting-started prompts", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByRole("heading", { name: "Log your first workout" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Snap your first meal" })).toBeVisible();
});

test("Given a dark-mode device, Then the app renders its dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bg.match(/[\d.]+/g) ?? []).map(Number);
  // oklch backgrounds may serialize as oklch(L ...) — treat lightness < 0.3 as dark
  if (bg.startsWith("oklch")) expect(r!).toBeLessThan(0.3);
  else expect((r! + g! + b!) / 3).toBeLessThan(60);
});
