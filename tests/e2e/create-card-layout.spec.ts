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
  throw new Error("Missing Supabase credentials for create-card visual tests");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const GENERATED_CARD_FIXTURE = {
  language: "en",
  tier: "A2",
  termKind: "word",
  term: "lantern",
  partOfSpeech: "noun",
  pronunciation: "/LAN-tern/",
  translations: {
    tr: "fener",
    en: "lantern",
    de: "laterne",
    ru: "fonar",
    fr: "lanterne",
    es: "linterna",
    it: "lanterna",
    pt: "lanterna",
    nl: "lantaarn",
    pl: "latarnia",
    ar: "fanus",
    ja: "rantan",
    ko: "raenteon",
    "zh-CN": "denglong",
  },
  example: "She carried a lantern through the forest path.",
  exampleTranslation: "Orman yolunda bir fener tasiyordu.",
  grammar: ["Countable noun", "Often used for portable light sources"],
} as const;

test.describe.configure({ mode: "serial", timeout: 120_000 });

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

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name: "Visual Test",
      preferred_language_code: "en",
      preferred_ui_locale: "en",
      preferred_tier: "A1",
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw profileError;
  }
}

test.beforeAll(async () => {
  await ensureVisualTestUser();
});

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile") {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("button", { name: /continue on web/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /continue on web/i }).click();
    await expect(page.getByRole("button", { name: /use email instead/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /use email instead/i }).click();
  } else {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('input[type="email"]').first().fill(TEST_USER.email);
  await page.locator('input[type="password"]').first().fill(TEST_USER.password);
  await Promise.all([
    page.waitForURL(/\/(card-draw|my-cards|learn|register\/preferences)/, { timeout: 60_000 }),
    page.getByRole("button", { name: /log in/i }).first().click(),
  ]);
});

test("create-card stays inside the viewport band and centers the form", async ({ page }, testInfo) => {
  await page.goto("/create-card", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("[data-create-card-page]")).toBeVisible();

  const layout = await page.evaluate(() => {
    const frame = document.querySelector("[data-create-card-page]") as HTMLElement | null;
    const content = document.querySelector("[data-create-card-form]") as HTMLElement | null;
    const header = document.querySelector("header") as HTMLElement | null;
    const mobileNav = document.querySelector("[data-mobile-main-nav-frame]") as HTMLElement | null;
    const scroller = document.scrollingElement;

    if (!frame || !content || !header || !scroller) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const mobileNavRect = mobileNav?.getBoundingClientRect() ?? null;

    return {
      frameTop: frameRect.top,
      frameBottom: frameRect.bottom,
      frameCenterY: frameRect.top + frameRect.height / 2,
      contentCenterY: contentRect.top + contentRect.height / 2,
      headerBottom: headerRect.bottom,
      mobileNavTop: mobileNavRect?.top ?? null,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });

  expect(layout).not.toBeNull();
  expect(Math.abs(layout!.frameTop - layout!.headerBottom)).toBeLessThanOrEqual(2);

  if (testInfo.project.name === "mobile") {
    expect(layout!.mobileNavTop).not.toBeNull();
    expect(Math.abs(layout!.frameBottom - layout!.mobileNavTop!)).toBeLessThanOrEqual(2);
  } else {
    expect(layout!.frameBottom).toBeLessThanOrEqual(layout!.clientHeight);
  }

  expect(Math.abs(layout!.frameCenterY - layout!.contentCenterY)).toBeLessThanOrEqual(24);
  expect(layout!.scrollHeight).toBeLessThanOrEqual(layout!.clientHeight + 1);

  await page.screenshot({
    path: `.tmp/visual-tests/create-card-form-${testInfo.project.name}.png`,
    fullPage: false,
  });
});

test("create-card preview overlay covers the full band without introducing scroll", async ({ page }, testInfo) => {
  await page.route("**/api/cards/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(GENERATED_CARD_FIXTURE),
    });
  });

  await page.goto("/create-card", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("#term").fill("lantern");
  await page.getByRole("button", { name: /generate/i }).click();

  const overlay = page.locator("[data-create-card-overlay]");
  await expect(overlay).toBeVisible();

  const layout = await page.evaluate(() => {
    const frame = document.querySelector("[data-create-card-page]") as HTMLElement | null;
    const overlayElement = document.querySelector("[data-create-card-overlay]") as HTMLElement | null;
    const overlayPanel = document.querySelector("[data-create-card-overlay-panel]") as HTMLElement | null;
    const header = document.querySelector("header") as HTMLElement | null;
    const mobileNav = document.querySelector("[data-mobile-main-nav-frame]") as HTMLElement | null;
    const scroller = document.scrollingElement;

    if (!frame || !overlayElement || !overlayPanel || !header || !scroller) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const overlayRect = overlayElement.getBoundingClientRect();
    const overlayPanelRect = overlayPanel.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const mobileNavRect = mobileNav?.getBoundingClientRect() ?? null;

    return {
      overlayTop: overlayRect.top,
      overlayBottom: overlayRect.bottom,
      overlayCenterY: overlayRect.top + overlayRect.height / 2,
      panelCenterY: overlayPanelRect.top + overlayPanelRect.height / 2,
      headerBottom: headerRect.bottom,
      frameTop: frameRect.top,
      frameBottom: frameRect.bottom,
      mobileNavTop: mobileNavRect?.top ?? null,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });

  expect(layout).not.toBeNull();
  expect(Math.abs(layout!.overlayTop - layout!.headerBottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(layout!.overlayTop - layout!.frameTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(layout!.overlayBottom - layout!.frameBottom)).toBeLessThanOrEqual(2);

  if (testInfo.project.name === "mobile") {
    expect(layout!.mobileNavTop).not.toBeNull();
    expect(Math.abs(layout!.overlayBottom - layout!.mobileNavTop!)).toBeLessThanOrEqual(2);
  }

  expect(Math.abs(layout!.overlayCenterY - layout!.panelCenterY)).toBeLessThanOrEqual(28);
  expect(layout!.scrollHeight).toBeLessThanOrEqual(layout!.clientHeight + 1);

  await page.screenshot({
    path: `.tmp/visual-tests/create-card-overlay-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
