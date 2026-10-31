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

  test("shows the login screen after the mobile logout redirect", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("foxiesdeck:google-auth-pending", String(Date.now()));
    });
    await page.goto("/?mobile-gateway-login=1");

    await expect(page.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Use email instead/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue on web/i })).toBeHidden();
    await expect(page.locator("[data-google-auth-loading]")).toBeHidden();
  });

  test("opens login and removes the tutorial overlay when mobile logout is requested", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("foxiesdeck:google-auth-pending", String(Date.now()));
      window.localStorage.setItem("foxiesdeck:tutorial", JSON.stringify({
        state: { active: true, completed: false, introSeen: false, step: 0 },
        version: 2,
      }));
    });
    await page.goto("/?mobile-gateway-login=1&tutorial-test=1");
    await expect(page.locator("[data-mobile-auth-gateway]")).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("foxiesdeck:mobile-logout-auth-requested"));
    });

    await expect(page.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
    await expect(page.locator("[data-landing-tutorial]")).toHaveCount(0);
    await expect(page.locator("[data-google-auth-loading]")).toHaveCount(0);
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
