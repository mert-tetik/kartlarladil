import { expect, test } from "@playwright/test";

test.describe("language swap rule", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test("swaps practice language and site language when they would match", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue on web/i }).click();
    await page.getByRole("button", { name: /Use email instead/i }).click();

    // Defaults in the mobile email form: practice language = en, site language = tr.
    await expect(page.locator('[data-language-picker="preferredLanguageCode"] input[type="hidden"]')).toHaveValue("en");
    await expect(page.locator('[data-language-picker="preferredUiLocale"] input[type="hidden"]')).toHaveValue("tr");

    // Change site language to English (same as practice language) → practice language should swap to Turkish.
    await page.locator('[data-language-picker="preferredUiLocale"] button').click();
    await page.getByRole("dialog").getByRole("button", { name: /English/ }).first().click();

    await expect(page.locator('[data-language-picker="preferredLanguageCode"] input[type="hidden"]')).toHaveValue("tr");
    await expect(page.locator('[data-language-picker="preferredUiLocale"] input[type="hidden"]')).toHaveValue("en");

    // Change practice language to English (same as site language) → site language should swap to Turkish.
    await page.locator('[data-language-picker="preferredLanguageCode"] button').click();
    await page.getByRole("dialog").getByRole("button", { name: /English/ }).first().click();

    await expect(page.locator('[data-language-picker="preferredLanguageCode"] input[type="hidden"]')).toHaveValue("en");
    await expect(page.locator('[data-language-picker="preferredUiLocale"] input[type="hidden"]')).toHaveValue("tr");

    await expect(page).toHaveScreenshot("language-swap-form.png", {
      animations: "disabled",
      timeout: 30_000,
    });
  });
});
