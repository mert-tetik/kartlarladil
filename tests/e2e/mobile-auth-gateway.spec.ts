import { expect, test } from "@playwright/test";

test.describe("mobile auth gateway", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test("replaces the landing UI for logged-out mobile users", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-mobile-auth-gateway]")).toBeVisible();
    await expect(page.locator("[data-mobile-landing-dashboard]")).toBeHidden();
    await expect(page.getByRole("button", { name: /Continue on web/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Get from Play Store/i })).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-auth-choice-screen.png", {
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("shows the auth screen after choosing to continue on web", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue on web/i }).click();

    await expect(page.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Use email instead/i })).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-auth-screen.png", {
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("toggles the email form and switches login/register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue on web/i }).click();
    await page.getByRole("button", { name: /Use email instead/i }).click();

    await expect(page.getByRole("button", { name: /^Log in$/i })).toBeVisible();
    await expect(page.locator("[data-language-picker]")).toHaveCount(0);

    await page.getByRole("button", { name: /No account/i }).click();
    await expect(page.getByRole("button", { name: /^Sign up$/i })).toBeVisible();
    await expect(page.locator("[data-language-picker]")).toHaveCount(0);
  });

  test("redirects old auth pages to home on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");

    await page.goto("/register");
    await expect(page).toHaveURL("/");

    await page.goto("/register/preferences");
    await expect(page).toHaveURL("/");
  });
});
