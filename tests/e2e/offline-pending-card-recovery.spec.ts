import { expect, test } from "@playwright/test";

const generatedCard = {
  language: "en",
  tier: "A1",
  termKind: "word",
  term: "fox",
  partOfSpeech: "noun",
  pronunciation: "foks",
  translations: {
    tr: "tilki", en: "fox", de: "Fuchs", ru: "лиса", fr: "renard", es: "zorro", it: "volpe",
    pt: "raposa", nl: "vos", pl: "lis", ar: "ثعلب", ja: "キツネ", ko: "여우", "zh-CN": "狐狸",
  },
  examples: [
    { sentence: "A fox crossed the quiet road.", translation: "A fox crossed the quiet road." },
    { sentence: "The fox rested near an old tree.", translation: "The fox rested near an old tree." },
  ],
  definitions: {
    tr: "Küçük bir yırtıcı memeli.", en: "A small wild animal.", de: "Ein kleines wildes Tier.",
    ru: "Небольшое дикое животное.", fr: "Un petit animal sauvage.", es: "Un animal salvaje pequeño.",
    it: "Un piccolo animale selvatico.", pt: "Um pequeno animal selvagem.", nl: "Een klein wild dier.",
    pl: "Małe dzikie zwierzę.", ar: "حيوان بري صغير.", ja: "小さな野生動物。", ko: "작은 야생 동물。",
    "zh-CN": "一种小型野生动物。",
  },
  grammar: [],
};

test("cold-start recovers from a persisted offline-note preview without deleting its draft", async ({ page }) => {
  const fallbackDraftKey = "foxiesdeck-offline-v1:fallback:drafts:guest";
  const malformedDraftRecord = [{
    key: "guest:draft-recovery-123",
    profileId: "guest",
    draft: {
      id: "draft-recovery-123",
      noteId: "note-recovery-123",
      sourceProfileId: "guest",
      storageProfileId: "guest",
      targetLanguage: "en",
      generated: { term: "incomplete stored card" },
      createdAt: "2026-10-20T00:00:00.000Z",
      pendingAdd: true,
    },
  }];

  await page.addInitScript(({ fallbackDraftKey, malformedDraftRecord }) => {
    localStorage.setItem("foxiesdeck:v3", JSON.stringify({
      state: {
        cards: [
          { cardId: "custom:user-1:durable-card", status: "active", correctCount: 1, addedAt: "2026-10-19T00:00:00.000Z" },
          { cardId: "offline-pending:guest:draft-recovery-123", status: "active", correctCount: 0, addedAt: "2026-10-20T00:00:00.000Z" },
        ],
        attempts: [],
        ownerUserId: null,
      },
      version: 0,
    }));
    localStorage.setItem(fallbackDraftKey, JSON.stringify(malformedDraftRecord));
  }, { fallbackDraftKey, malformedDraftRecord });

  await page.goto("/card-draw");
  await expect(page.locator("[data-card-draw-page]")).toBeVisible();
  await expect(page.getByText("Page couldn’t load")).toHaveCount(0);

  await expect.poll(() => page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem("foxiesdeck:v3") ?? "{}");
    return persisted.state?.cards?.map((card: { cardId: string }) => card.cardId) ?? [];
  })).toEqual(["custom:user-1:durable-card"]);

  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), fallbackDraftKey))
    .toBe(JSON.stringify(malformedDraftRecord));
});

test("server rejection restores the offline draft instead of retrying it on every launch", async ({ page }) => {
  const draftId = "draft-recovery-456";
  const fallbackDraftKey = "foxiesdeck-offline-v1:fallback:drafts:guest";
  const storedDraft = {
    id: draftId,
    noteId: "note-recovery-456",
    sourceProfileId: "guest",
    storageProfileId: "guest",
    targetLanguage: "en",
    generated: generatedCard,
    createdAt: "2026-10-20T00:00:00.000Z",
    pendingAdd: true,
  };
  let createRequestCount = 0;

  await page.route("**/api/offline/reachability", (route) => route.fulfill({ status: 200 }));
  await page.route("**/api/cards/offline-create", async (route) => {
    createRequestCount += 1;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ status: "error", message: "Invalid offline card" }),
    });
  });
  await page.addInitScript(({ fallbackDraftKey, storedDraft }) => {
    localStorage.setItem(fallbackDraftKey, JSON.stringify([{
      key: `guest:${storedDraft.id}`,
      profileId: "guest",
      draft: storedDraft,
    }]));
  }, { fallbackDraftKey, storedDraft });

  await page.goto("/card-draw");
  const overlay = page.locator("[data-offline-note-conversion-overlay]");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("data-offline-draft-count", "1");
  await expect.poll(() => createRequestCount).toBe(1);

  await expect.poll(() => page.evaluate(async (draftId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("foxiesdeck-offline-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Array<{ draft: { id: string; pendingAdd?: boolean } }>>((resolve, reject) => {
      const request = database.transaction("drafts", "readonly").objectStore("drafts").index("profileId").getAll("guest");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows.find((row) => row.draft.id === draftId)?.draft.pendingAdd ?? null;
  }, draftId)).toBe(false);

  await expect.poll(() => page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem("foxiesdeck:v3") ?? "{}");
    return persisted.state?.cards?.some((card: { cardId: string }) => card.cardId.startsWith("offline-pending:")) ?? false;
  })).toBe(false);
  expect(createRequestCount).toBe(1);
});
