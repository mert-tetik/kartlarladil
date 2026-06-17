import { test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

test("card front is dark with white text in dark theme", async ({ page }) => {
  await page.goto("/card-draw", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Search word, translation, or example sentence").fill("from");
  await page.locator('[data-card-draw-workbench] button').filter({ hasText: /from/ }).first().click();

  const card = page.locator('[data-card-face="back"]').first();
  await card.getByText("Click to flip").waitFor();
  await card.click();
  await page.locator('[data-card-face="front"]').first().waitFor();

  await page.evaluate(() => document.body.setAttribute("data-theme", "default-dark"));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.body.setAttribute("data-theme", "default-dark"));

  await page.screenshot({ path: "test-results/card-dark-preview.png", fullPage: false });
});
