import { expect, test } from "@playwright/test";

test.describe("mobile email form", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test("hides language pickers so preferences are collected during onboarding", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue on web/i }).click();
    await page.getByRole("button", { name: /Use email instead/i }).click();

    await expect(page.getByRole("button", { name: /^Log in$/i })).toBeVisible();
    await expect(page.locator("[data-language-picker]")).toHaveCount(0);
  });
});
