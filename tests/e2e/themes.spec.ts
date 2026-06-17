import { test } from "@playwright/test";

const THEME_IDS = [
  "default",
  "default-dark",
  "ocean",
  "ocean-dark",
  "emerald",
  "emerald-dark",
  "violet",
  "violet-dark",
  "rose",
  "rose-dark",
  "amber",
  "amber-dark",
  "teal",
  "teal-dark",
  "indigo",
  "indigo-dark",
  "crimson",
  "crimson-dark",
  "lime",
  "lime-dark",
];

const PAGES = [
  { name: "card-draw", path: "/card-draw" },
  { name: "pricing", path: "/pricing" },
];

test.describe("theme visual regression", () => {
  for (const themeId of THEME_IDS) {
    for (const { name, path } of PAGES) {
      test(`${name} renders with ${themeId} theme`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("body", { state: "attached" });
        await page.evaluate((id) => document.body.setAttribute("data-theme", id), themeId);
        await page.waitForTimeout(500);
        await page.evaluate((id) => document.body.setAttribute("data-theme", id), themeId);
        await page.screenshot({
          path: `test-results/themes/${name}-${themeId}-${test.info().project.name}.png`,
          fullPage: false,
        });
      });
    }
  }
});
