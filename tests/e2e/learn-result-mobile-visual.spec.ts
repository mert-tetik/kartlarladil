import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFromDotLocal } from "./env-helper";

loadEnvFromDotLocal();

const TEST_RUN_ID = Date.now().toString(36);

const TEST_USER = {
  email: `visual-test-${TEST_RUN_ID}@foxiesdeck.local`,
  password: "VisualTest123!",
};

const LEARNED_CARD_SOURCE_KEYS = [
  "en:A1:word:about:adverb",
  "en:A1:word:above:adverb",
  "en:A1:word:across:adverb",
  "en:A1:word:action:noun",
  "en:A1:word:activity:noun",
  "en:A1:word:actor:noun",
  "en:A1:word:actress:noun",
  "en:A1:word:add:verb",
  "en:A1:word:address:noun",
  "en:A1:word:advice:noun",
] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for learn result visual tests");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

test.describe.configure({ mode: "serial", timeout: 120_000 });
test.use({ viewport: { width: 412, height: 915 } });

async function ensureVisualTestUser() {
  const { data: existing, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  let user = existing.users.find((item) => item.email === TEST_USER.email);

  if (!user) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
    });

    if (createError) {
      throw createError;
    }

    user = created.user;
  }

  if (!user) {
    throw new Error("Failed to provision visual test user");
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name: "Visual Test",
      preferred_language_code: "en",
      preferred_ui_locale: "en",
      preferred_tier: "A1",
      onboarding_completed: true,
      ai_practice_points: 250,
      chest_points: 0,
      streak_points: 0,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw profileError;
  }

  await supabase.from("practice_attempts").delete().eq("user_id", user.id);
  await supabase.from("user_cards").delete().eq("user_id", user.id);

  const learnedCards = LEARNED_CARD_SOURCE_KEYS.map((cardSourceKey, index) => ({
    user_id: user.id,
    card_source_key: cardSourceKey,
    status: "learned",
    correct_count: 4,
    added_at: now,
    learned_at: new Date(Date.now() - index * 60_000).toISOString(),
  }));

  const { error: cardsError } = await supabase.from("user_cards").insert(learnedCards);

  if (cardsError) {
    throw cardsError;
  }
}

async function loginOnMobile(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByRole("button", { name: /continue on web/i })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /continue on web/i }).click();
  await expect(page.getByRole("button", { name: /use email instead/i })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /use email instead/i }).click();

  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('input[type="email"]').first().fill(TEST_USER.email);
  await page.locator('input[type="password"]').first().fill(TEST_USER.password);
  await page.getByRole("button", { name: /log in/i }).first().click();

  await page.waitForFunction(() => window.location.pathname !== "/login", undefined, {
    timeout: 60_000,
  });

  const gateway = page.locator("[data-mobile-auth-gateway]");
  if (await gateway.isVisible().catch(() => false)) {
    const continueFreeButton = gateway.getByRole("button").last();
    await expect(continueFreeButton).toBeVisible({ timeout: 15_000 });
    await continueFreeButton.click();
    await expect(gateway).toBeHidden({ timeout: 30_000 });
  }
}

test.beforeEach(async ({ page }) => {
  await ensureVisualTestUser();
  await page.route("**/api/leaderboard", async (route) => {
    const entries = Array.from({ length: 25 }, (_, index) => {
      const position = index + 1;
      return {
        userId: position === 20 ? "viewer-user" : `user-${position}`,
        position,
        displayName: position === 20 ? "Visual Test" : `Player ${position}`,
        totalPoints: 2000 - position * 40,
        rankIcon: position <= 2 ? "medal" : position <= 8 ? "book" : "trophy",
        isViewer: position === 20,
      };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        viewer: {
          userId: "viewer-user",
          position: 20,
          displayName: "Visual Test",
          totalPoints: 350,
          leaderboardVisible: true,
        },
        entries,
        canViewLeaderboard: true,
      }),
    });
  });
  await loginOnMobile(page);
});

test("learn practice result stays vertically centered on mobile", async ({ page }) => {
  await page.goto("/learn?mode=learned&language=en", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const countSelection = page.locator("[data-quiz-count-selection]");
  await expect(countSelection).toBeVisible({ timeout: 60_000 });
  await countSelection.getByRole("button", { name: "10" }).click();

  await expect(page.locator("[data-learn-quiz-page='quiz']")).toBeVisible({ timeout: 60_000 });

  for (let index = 0; index < 10; index += 1) {
    const option = page.locator("[data-quiz-option]").first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();

    const nextButton = page.locator("[data-quiz-mobile-feedback-next]");
    await expect(nextButton).toBeVisible({ timeout: 15_000 });
    await nextButton.click();
  }

  const resultPanel = page.locator("[data-quiz-result-panel]");
  await expect(resultPanel).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-leaderboard-standing]")).toHaveText("You're #20!", { timeout: 30_000 });
  await expect(page.locator("[data-leaderboard-scope]")).toHaveText("Worldwide");

  const layout = await page.evaluate(() => {
    const overlay = document.querySelector("[data-quiz-overlay='result']") as HTMLElement | null;
    const panel = document.querySelector("[data-quiz-result-panel]") as HTMLElement | null;
    const header = document.querySelector("header") as HTMLElement | null;

    if (!overlay || !panel || !header) {
      return null;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();

    const standing = document.querySelector("[data-leaderboard-standing]") as HTMLElement | null;
    const scope = document.querySelector("[data-leaderboard-scope]") as HTMLElement | null;

    return {
      overlayTop: overlayRect.top,
      overlayBottom: overlayRect.bottom,
      overlayCenterY: overlayRect.top + overlayRect.height / 2,
      panelCenterY: panelRect.top + panelRect.height / 2,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      headerBottom: headerRect.bottom,
      viewportHeight: window.innerHeight,
      standingFontSize: standing ? Number.parseFloat(window.getComputedStyle(standing).fontSize) : 0,
      scopeFontSize: scope ? Number.parseFloat(window.getComputedStyle(scope).fontSize) : 0,
    };
  });

  expect(layout).not.toBeNull();
  console.log("learn-result-layout", JSON.stringify(layout));
  expect(layout!.panelTop).toBeGreaterThanOrEqual(layout!.headerBottom);
  expect(layout!.panelBottom).toBeLessThanOrEqual(layout!.viewportHeight);
  expect(Math.abs(layout!.overlayCenterY - layout!.panelCenterY)).toBeLessThanOrEqual(28);
  expect(layout!.standingFontSize).toBeGreaterThanOrEqual(30);
  expect(layout!.scopeFontSize).toBeLessThan(layout!.standingFontSize);

  await page.screenshot({
    path: ".tmp/visual-tests/learn-result-mobile.png",
    fullPage: false,
  });
});

test("leaderboard page stays fixed and scrolls to the current user on mobile", async ({ page }) => {
  await page.goto("/leaderboard", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const list = page.locator("[data-leaderboard-list]");
  await expect(list).toHaveAttribute("data-state", "loaded", { timeout: 30_000 });
  await expect(page.locator("[data-leaderboard-standing]")).toHaveText("You're #20!", { timeout: 30_000 });
  await expect(page.locator("[data-leaderboard-scope]")).toHaveText("Worldwide");

  const viewerRow = page.locator('[data-leaderboard-entry="viewer"]');
  await expect(viewerRow).toBeVisible({ timeout: 30_000 });

  const layout = await page.evaluate(() => {
    const pageRoot = document.querySelector("[data-leaderboard-page]") as HTMLElement | null;
    const listBox = document.querySelector("[data-leaderboard-list]") as HTMLElement | null;
    const viewer = document.querySelector('[data-leaderboard-entry="viewer"]') as HTMLElement | null;

    if (!pageRoot || !listBox || !viewer) {
      return null;
    }

    const pageRect = pageRoot.getBoundingClientRect();
    const listRect = listBox.getBoundingClientRect();
    const viewerRect = viewer.getBoundingClientRect();

    const standing = document.querySelector("[data-leaderboard-standing]") as HTMLElement | null;
    const scope = document.querySelector("[data-leaderboard-scope]") as HTMLElement | null;

    return {
      viewportHeight: window.innerHeight,
      pageTop: pageRect.top,
      pageBottom: pageRect.bottom,
      listTop: listRect.top,
      listBottom: listRect.bottom,
      viewerTop: viewerRect.top,
      viewerBottom: viewerRect.bottom,
      listScrollTop: listBox.scrollTop,
      bodyScrollHeight: document.body.scrollHeight,
      standingFontSize: standing ? Number.parseFloat(window.getComputedStyle(standing).fontSize) : 0,
      scopeFontSize: scope ? Number.parseFloat(window.getComputedStyle(scope).fontSize) : 0,
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.pageTop).toBeGreaterThanOrEqual(0);
  expect(layout!.pageBottom).toBeLessThanOrEqual(layout!.viewportHeight);
  expect(layout!.viewerTop).toBeGreaterThanOrEqual(layout!.listTop);
  expect(layout!.viewerBottom).toBeLessThanOrEqual(layout!.listBottom);
  expect(layout!.listScrollTop).toBeGreaterThan(0);
  expect(layout!.bodyScrollHeight).toBeLessThanOrEqual(layout!.viewportHeight + 24);
  expect(layout!.standingFontSize).toBeGreaterThanOrEqual(34);
  expect(layout!.scopeFontSize).toBeLessThan(layout!.standingFontSize);

  await page.screenshot({
    path: ".tmp/visual-tests/leaderboard-mobile.png",
    fullPage: false,
  });
});
