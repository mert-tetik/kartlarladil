import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFromDotLocal } from "./env-helper";

loadEnvFromDotLocal();

const TEST_USER = {
  email: "visual-test@foxiesdeck.local",
  password: "VisualTest123!",
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for visual tests");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

test.use({ viewport: { width: 412, height: 915 } });

test.beforeEach(async ({ page }) => {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const user = existing?.users?.find((u) => u.email === TEST_USER.email);

  if (user) {
    await supabase.from("user_cards").delete().eq("user_id", user.id);
    await supabase.from("practice_attempts").delete().eq("user_id", user.id);
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(TEST_USER.email);
  await page.locator('input[type="password"]').fill(TEST_USER.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(card-draw|my-cards|learn)/, { timeout: 15_000 });
});

test.skip("learn mobile visual flow - mode, language, count and quiz screens", async ({ page }) => {
  test.setTimeout(120_000);

  page.on("console", (message) => {
    console.log(`[page:${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    console.log(`[pageerror] ${error.message}`);
  });

  await page.goto("/card-draw", { waitUntil: "domcontentloaded" });

  const poolLoading = page.getByText(/pool is getting ready|hazne hazırlanıyor/i);
  await expect(poolLoading).toBeHidden({ timeout: 120_000 });

  const drawTen = page.getByRole("button", { name: /draw 10/i });
  await expect(drawTen).toBeVisible({ timeout: 10_000 });
  await drawTen.click();

  await expect(page.getByText(/haznede|owned|added/i).first()).toBeVisible({ timeout: 10_000 });

  await page.goto("/learn", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/how do you want to practice\?|nasıl çalışmak istiyorsun/i)).toBeVisible();
  await page.screenshot({ path: ".tmp/visual-tests/learn-mode-mobile.png", fullPage: false });

  const learnModeButton = page.locator("[data-learn-page]").getByRole("button", { name: /learn/i }).first();
  await expect(learnModeButton).toBeVisible();
  await learnModeButton.click();

  await expect(page.locator("[data-quiz-language-selection]")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".tmp/visual-tests/learn-language-mobile.png", fullPage: false });

  const englishButton = page.locator("[data-quiz-language-selection]").getByRole("button", { name: /english/i });
  await expect(englishButton).toBeVisible();
  await englishButton.click();

  await expect(page.locator("[data-quiz-count-selection]")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".tmp/visual-tests/learn-count-mobile.png", fullPage: false });

  const tenButton = page.locator("[data-quiz-count-selection]").getByRole("button", { name: "10" });
  await expect(tenButton).toBeVisible();
  await tenButton.click();

  await expect(page.locator("[data-learn-quiz-page='quiz']")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: ".tmp/visual-tests/learn-quiz-mobile.png", fullPage: false });
});
