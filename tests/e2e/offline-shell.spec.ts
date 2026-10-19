import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const OFFLINE_LANGUAGE_CODES = ["ar", "de", "en", "es", "fr", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "zh-CN"];

type PackagedOfflineAsset = { file: string; contentType: string };

function getPackagedOfflineAssets(): Map<string, PackagedOfflineAsset> {
  const assets = new Map<string, PackagedOfflineAsset>([
    ["/offline-shell/index.html", { file: "offline-shell/index.html", contentType: "text/html; charset=utf-8" }],
    ["/offline-shell/offline-shell.js", { file: "offline-shell/offline-shell.js", contentType: "application/javascript; charset=utf-8" }],
    ["/offline-shell/super-water.ttf", { file: "offline-shell/super-water.ttf", contentType: "font/ttf" }],
    ["/missions/cikinti-v2.png", { file: "missions/cikinti-v2.png", contentType: "image/png" }],
  ]);
  for (const language of OFFLINE_LANGUAGE_CODES) {
    assets.set(`/flags/language/${language}.png`, {
      file: `flags/language/${language}.png`,
      contentType: "image/png",
    });
  }
  return assets;
}

async function serveBundledOfflineAssets(page: import("@playwright/test").Page) {
  const packagedAssets = getPackagedOfflineAssets();
  const unexpectedRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const asset = requestUrl.origin === "https://www.foxiesdeck.com"
      ? packagedAssets.get(requestUrl.pathname)
      : undefined;
    if (!asset) {
      unexpectedRequests.push(requestUrl.href);
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: asset.contentType,
      body: await readFile(path.join(PUBLIC_DIR, asset.file)),
    });
  });
  return unexpectedRequests;
}

test("cold-starts the offline language picker from bundled assets while fully offline", async ({ page, context }) => {
  const unexpectedRequests = await serveBundledOfflineAssets(page);

  await page.addInitScript(() => {
    localStorage.setItem("foxiesdeck:offline-profile", "guest");
    localStorage.setItem("foxiesdeck:locale", "tr");
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: { open: () => ({}) },
    });
  });

  await context.setOffline(true);
  await page.goto("https://www.foxiesdeck.com/offline-shell/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-ready", "true");
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "loading");
  await expect(page.locator("#saved-card-filter-active-label")).toHaveText("Öğrenilecek");
  await expect(page.locator("#saved-card-filter-learned-label")).toHaveText("Öğrenilmiş");
  await expect(page.locator("#card-language-label")).toHaveText("Kart Dili");

  await expect.poll(() => page.locator("#card-language-options img").evaluateAll((images) =>
    images.length === 28 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);

  await page.locator("#card-language-select").tap();
  await expect(page.locator('#card-language-sheet[data-open="true"]')).toBeVisible();
  await page.locator('.language-option[data-language="ja"]').tap();
  await expect(page.locator("#card-language-current")).toHaveText("Japonca");
  await expect(page.locator("#card-language-current-flag img")).toHaveJSProperty("naturalWidth", 512);
  await expect(page.locator("body")).toHaveAttribute("data-offline-card-language", "ja");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-ready", "true");
  await expect(page.locator("#card-language-current")).toHaveText("Japonca");
  await expect(page.locator("#card-language-current-flag img")).toHaveJSProperty("naturalWidth", 512);
  await expect(page.locator('[data-card-filter="active"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-card-filter="learned"]').tap();
  await expect(page.locator('[data-card-filter="learned"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-card-filter="active"]')).toHaveAttribute("aria-pressed", "false");

  await page.locator("#note-input").fill("offline note");
  await page.locator("#add-note").tap();
  await expect(page.locator("#notes-list")).toContainText("offline note");
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("foxiesdeck-offline-v1:fallback:notes:guest")?.includes("offline note") ?? false,
  )).toBe(true);

  await page.locator(".remove-note").tap();
  await expect(page.locator("#notes-list .note-row")).toHaveCount(0);
  await page.locator("#reconnect").tap();
  await expect(page.locator(".offline-app-message")).toContainText("FoxiesDeck'e hâlâ ulaşılamıyor");
  await expect(page.locator("#reconnect")).toBeEnabled();
  expect(unexpectedRequests).toEqual([]);
});

test("a note dismissed without IndexedDB access stays dismissed after an offline reload", async ({ page, context }) => {
  const unexpectedRequests = await serveBundledOfflineAssets(page);
  await page.addInitScript(() => {
    localStorage.setItem("foxiesdeck:offline-profile", "guest");
    localStorage.setItem("foxiesdeck:locale", "tr");
  });
  await context.setOffline(true);
  await page.goto("https://www.foxiesdeck.com/offline-shell/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-ready", "true");
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");

  await page.evaluate(async () => {
    const offline = (window as unknown as Window & {
      FoxiesDeckOffline: {
        putNote: (profileId: string, note: { id: string; text: string; targetLanguage: string; nativeLocale: string; createdAt: string }) => Promise<unknown>;
      };
    }).FoxiesDeckOffline;
    await offline.putNote("guest", {
      id: "indexeddb-only-note",
      text: "dismiss this note",
      targetLanguage: "en",
      nativeLocale: "tr",
      createdAt: new Date().toISOString(),
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");
  await expect(page.locator("#notes-list")).toContainText("dismiss this note");

  await page.evaluate(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: { open: () => ({}) } });
  });
  await page.locator(".remove-note").tap();
  await expect(page.locator("#notes-list .note-row")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("foxiesdeck-offline-v1:dismissed:notes:guest")?.includes("indexeddb-only-note") ?? false,
  )).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");
  await expect(page.locator("#notes-list .note-row")).toHaveCount(0);
  expect(unexpectedRequests).toEqual([]);
});

test("cached cards hydrate and filters remain usable without a network", async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem("foxiesdeck:offline-profile", "guest");
    localStorage.setItem("foxiesdeck:locale", "tr");
  });
  await page.goto("/offline-shell/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");

  await page.evaluate(async () => {
    const offline = (window as unknown as Window & {
      FoxiesDeckOffline: { saveSnapshot: (snapshot: unknown) => Promise<unknown> };
    }).FoxiesDeckOffline;
    await offline.saveSnapshot({
      profileId: "guest",
      nativeLanguage: "tr",
      cardLanguage: "es",
      complete: true,
      cards: [
        {
          inventory: { cardId: "offline-active", status: "active", correctCount: 2 },
          card: { language: "es", term: "aprender", tier: "A2", termKind: "word", translation: "to learn", translations: { tr: "öğrenmek", en: "to learn" } },
        },
        {
          inventory: { cardId: "offline-learned", status: "learned", correctCount: 4 },
          card: { language: "es", term: "sobremesa", tier: "A1", termKind: "word", translation: "table talk", translations: { tr: "sohbet", en: "table talk" } },
        },
      ],
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card-term")).toHaveText("aprender");

  await context.setOffline(true);
  await page.locator('[data-card-filter="learned"]').tap();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card-term")).toHaveText("sobremesa");
  await page.locator('[data-card-filter="active"]').tap();
  await expect(page.locator(".card-term")).toHaveText("aprender");

  await page.locator("#card-language-select").tap();
  await page.locator('.language-option[data-language="en"]').tap();
  await expect(page.locator("#card-language-current")).toHaveText("Ingilizce");
  await expect(page.locator(".empty")).toContainText("Bu dilde kaydedilmiş kartın yok.");
});

test("offline cards omit the language row and keep enlarged card details readable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("foxiesdeck:offline-profile", "guest");
    localStorage.setItem("foxiesdeck:locale", "tr");
  });
  await page.goto("/offline-shell/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-offline-shell-data", "ready");

  await page.evaluate(async () => {
    const offline = (window as unknown as Window & {
      FoxiesDeckOffline: { saveSnapshot: (snapshot: unknown) => Promise<unknown> };
    }).FoxiesDeckOffline;
    await offline.saveSnapshot({
      profileId: "guest",
      nativeLanguage: "tr",
      cardLanguage: "es",
      complete: true,
      cards: [{
        inventory: { cardId: "offline-readable-card", status: "active", correctCount: 2 },
        card: {
          language: "es",
          term: "aprender",
          tier: "A2",
          termKind: "word",
          pronunciation: "/a.prenˈder/",
          example: "Quiero aprender un idioma nuevo.",
          translation: "to learn",
          translations: { tr: "öğrenmek", en: "to learn" },
        },
      }],
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  const card = page.locator(".card");
  await expect(card).toBeVisible();
  await expect(card.locator(".card-meta, .card-language-code, .card-points")).toHaveCount(0);
  await expect(card.locator(".card-pronunciation")).toHaveText("/a.prenˈder/");
  await expect(card.locator(".card-pronunciation svg")).toHaveCount(0);
  await expect(card.locator(".card-kind")).toHaveCount(0);
  await expect(card.locator(".card-translation")).toHaveText("öğrenmek");
  await expect(card.locator(".card-example")).toContainText("Quiero aprender");

  const typography = await card.evaluate((node) => {
    const styleOf = (selector: string) => getComputedStyle(node.querySelector(selector) as Element);
    return {
      tier: Number.parseFloat(styleOf(".card-header").fontSize),
      term: Number.parseFloat(styleOf(".card-term").fontSize),
      translation: Number.parseFloat(styleOf(".card-translation").fontSize),
      example: Number.parseFloat(styleOf(".card-example").fontSize),
      progressText: Number.parseFloat(styleOf(".card-progress-label").fontSize),
      progressHeight: Number.parseFloat(styleOf(".card-progress-track").height),
    };
  });
  expect(typography.tier).toBeGreaterThanOrEqual(14);
  expect(typography.term).toBeLessThanOrEqual(36);
  expect(typography.translation).toBeGreaterThanOrEqual(22);
  expect(Number.parseFloat(await card.locator(".card-pronunciation").evaluate((node) => getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  expect(typography.example).toBeGreaterThanOrEqual(13);
  expect(typography.progressText).toBeGreaterThanOrEqual(12);
  expect(typography.progressHeight).toBeGreaterThanOrEqual(9);
});
