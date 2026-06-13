import { expect, test } from "@playwright/test";

const E2E_CARD = {
  detailsName: "from Card details",
  flipName: "from: Click to flip",
  id: "en:A1:word:from:kelime",
  searchTerm: "from",
  term: "from",
} as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test("landing page explains the product", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kartlarla Dil" })).toBeVisible();
  await expect(page.getByText("İlk sürüm: İngilizce, Almanca, Rusça")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Start drawing cards/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();

  const supportedLanguages = page.getByLabel("Supported languages");
  const supportedLanguageFlags = supportedLanguages.getByRole("img");
  await expect(supportedLanguageFlags).toHaveCount(14);
  await expect(supportedLanguageFlags.first()).toHaveAccessibleName("English");
  await expect(supportedLanguages.getByRole("img", { name: "Türkçe" })).toBeVisible();
  await expect(page.getByText("450 tek kelimelik kart")).toHaveCount(0);
  await expect(page.getByText("5 tier")).toHaveCount(0);
  await expect(page.getByText("Otomatik öğrenme takibi")).toHaveCount(0);

  const heroBackdrop = page.locator("[data-hero-card-backdrop]");
  const heroBackdropSets = heroBackdrop.locator("[data-hero-card-backdrop-set]");
  const firstHeroBackdropSet = heroBackdropSets.first();
  await expect(heroBackdropSets).toHaveCount(2);
  await expect(heroBackdrop.locator("[data-card-face]")).toHaveCount(48);
  await expect(heroBackdrop.locator('[data-card-face="back"]')).toHaveCount(24);
  const visibleBackTierLabels = await firstHeroBackdropSet.locator('[data-card-face="back"]').evaluateAll((cards) =>
    cards.map((card) => card.querySelector("[data-card-back-tier]")?.getAttribute("data-card-back-tier")),
  );
  expect(visibleBackTierLabels).toHaveLength(12);
  expect(visibleBackTierLabels.every((tier) => ["A1", "A2", "B1", "B2", "C1"].includes(tier ?? ""))).toBe(true);
  const backdropTrackAnimation = await heroBackdrop.locator("[data-hero-card-backdrop-track]").evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      animationDuration: style.animationDuration,
      animationName: style.animationName,
    };
  });
  expect(backdropTrackAnimation.animationName).toContain("hero-card-backdrop-loop");
  expect(backdropTrackAnimation.animationDuration).toBe("34s");
  const backdropVisualStyle = await heroBackdrop.evaluate((element) => {
    const wrapper = element.parentElement;
    const style = wrapper ? getComputedStyle(wrapper) : null;

    return {
      opacity: Number(style?.opacity ?? 0),
      filter: style?.filter ?? "",
    };
  });
  expect(backdropVisualStyle.opacity).toBeGreaterThanOrEqual(0.7);
  expect(backdropVisualStyle.filter).toContain("brightness");
  const backdropLayoutMetrics = await heroBackdrop.evaluate((element) => {
    const sets = Array.from(element.querySelectorAll("[data-hero-card-backdrop-set]"));
    const getRects = (set: Element | undefined) =>
      Array.from(set?.querySelectorAll("[data-card-face]") ?? []).map((card) => {
        const rect = card.getBoundingClientRect();

        return {
          bottom: Math.round(rect.bottom),
          face: card.getAttribute("data-card-face"),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      });
    const groupRows = (rects: ReturnType<typeof getRects>) => {
      const rowTops = Array.from(new Set(rects.map((rect) => rect.top))).sort((a, b) => a - b);

      return rowTops.map((top) => rects.filter((rect) => Math.abs(rect.top - top) <= 2).sort((a, b) => a.left - b.left));
    };
    const firstRows = groupRows(getRects(sets[0]));
    const secondRows = groupRows(getRects(sets[1]));
    const horizontalGaps = firstRows.flatMap((row, rowIndex) => {
      const internalGaps = row.slice(1).map((rect, index) => Math.round(rect.left - row[index].right));
      const seamGap = secondRows[rowIndex]?.[0] ? Math.round(secondRows[rowIndex][0].left - row.at(-1)!.right) : 0;

      return [...internalGaps, seamGap];
    });
    const backdropRect = element.getBoundingClientRect();
    const firstSetRects = firstRows.flat();
    const contentTop = Math.min(...firstSetRects.map((rect) => rect.top));
    const contentBottom = Math.max(...firstSetRects.map((rect) => rect.bottom));
    const verticalGap = firstRows[1]?.[0] ? Math.round(firstRows[1][0].top - firstRows[0][0].bottom) : 0;

    return {
      gapSpread: Math.max(...horizontalGaps) - Math.min(...horizontalGaps),
      minCardHeight: Math.min(...firstSetRects.map((rect) => rect.height)),
      minCardWidth: Math.min(...firstSetRects.map((rect) => rect.width)),
      rowBackCounts: firstRows.map((row) => row.filter((rect) => rect.face === "back").length),
      rowCount: firstRows.length,
      rowLengths: firstRows.map((row) => row.length),
      verticalCenterOffset: Math.round(
        Math.abs((contentTop + contentBottom) / 2 - (backdropRect.top + backdropRect.bottom) / 2),
      ),
      verticalGap,
    };
  });
  expect(backdropLayoutMetrics.rowCount).toBe(2);
  expect(backdropLayoutMetrics.rowLengths).toEqual([12, 12]);
  expect(backdropLayoutMetrics.rowBackCounts.every((count) => count > 0)).toBe(true);
  expect(backdropLayoutMetrics.minCardWidth).toBeGreaterThanOrEqual(240);
  expect(backdropLayoutMetrics.minCardHeight).toBeGreaterThanOrEqual(320);
  expect(backdropLayoutMetrics.verticalCenterOffset).toBeLessThanOrEqual(2);
  expect(backdropLayoutMetrics.verticalGap).toBeGreaterThanOrEqual(14);
  expect(backdropLayoutMetrics.gapSpread).toBeLessThanOrEqual(1);
  await expect(heroBackdrop.getByText("English").first()).toBeVisible();
  await expect(heroBackdrop.getByText("German").first()).toBeVisible();
  await expect(heroBackdrop.getByText("Russian").first()).toBeVisible();

  const collectionPreviewMetrics = await page.locator("[data-collection-preview-section]").evaluate((section) => {
    const visibleCards = Array.from(section.querySelectorAll("[data-collection-preview-card]")).filter((card) => {
      const rect = card.getBoundingClientRect();
      const style = getComputedStyle(card);

      return style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    const cardRects = visibleCards.map((card) => {
      const rect = card.getBoundingClientRect();

      return {
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    });

    return {
      cardCount: cardRects.length,
      minCardWidth: Math.min(...cardRects.map((rect) => rect.width)),
      topSpread: Math.max(...cardRects.map((rect) => rect.top)) - Math.min(...cardRects.map((rect) => rect.top)),
    };
  });
  const expectedCollectionCardCount = page.viewportSize()?.width && page.viewportSize()!.width < 640 ? 2 : 3;
  expect(collectionPreviewMetrics.cardCount).toBe(expectedCollectionCardCount);
  expect(collectionPreviewMetrics.topSpread).toBeLessThanOrEqual(2);
  expect(collectionPreviewMetrics.minCardWidth).toBeGreaterThanOrEqual(expectedCollectionCardCount === 2 ? 160 : 200);

  const pointsRankSection = page.locator("[data-points-rank-section]");
  await expect(pointsRankSection.getByRole("heading", { name: "Earn points and rank up." })).toBeVisible();
  await expect(pointsRankSection.getByText(/^A1$/)).toBeVisible();
  await expect(pointsRankSection.getByText(/^10 points$/)).toBeVisible();
  await expect(pointsRankSection.getByText(/^C1$/)).toBeVisible();
  await expect(pointsRankSection.getByText(/^110 points$/)).toBeVisible();
  await expect(pointsRankSection.getByText("Rank path")).toBeVisible();
  await expect(pointsRankSection.getByText("Starter")).toBeVisible();
  await expect(pointsRankSection.getByText("Legend")).toBeVisible();
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(2);
});

test("auth pages render public forms with password visibility toggles and preferences", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Log in" }).first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();

  const loginPassword = page.getByLabel("Password", { exact: true });
  await expect(loginPassword).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(loginPassword).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(loginPassword).toHaveAttribute("type", "password");

  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Sign up" }).first()).toBeVisible();
  await expect(page.getByText("Which language do you want to learn?")).toBeVisible();
  await expect(page.getByText("Which level should we start from?")).toBeVisible();
  const registerMain = page.getByRole("main");
  await expect(registerMain.getByRole("img", { name: "English" })).toBeVisible();
  await expect(registerMain.getByRole("img", { name: "Deutsch" })).toBeVisible();
  await expect(page.locator('input[name="preferredLanguageCode"][value="en"]')).toBeChecked();
  await expect(page.locator('input[name="preferredTier"][value="A1"]')).toBeChecked();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.locator('input[name="next"]')).toHaveValue("/card-draw");

  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Reset password" }).first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("register preserves next and links back to login with the same next", async ({ page }) => {
  await page.goto("/register?next=%2Fcard-draw", { waitUntil: "domcontentloaded" });

  await expect(page.locator('input[name="next"]')).toHaveValue("/card-draw");
  await expect(page.locator('a[href="/login?next=%2Fcard-draw"]').first()).toBeVisible();
});

test("card draw filters default to English A1 and remember user choices", async ({ page }) => {
  await page.goto("/card-draw", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: /English/ })).toHaveAttribute("aria-haspopup", "listbox");
  await expect(page.getByRole("button", { name: "A1" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /English/ }).click();
  await page.getByRole("option", { name: /German/ }).click();
  await page.getByRole("button", { name: "B1" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: /German/ })).toHaveAttribute("aria-haspopup", "listbox");
  await expect(page.getByRole("button", { name: "B1" })).toHaveAttribute("aria-pressed", "true");
});

test("account settings redirects guests to login", async ({ page }) => {
  await page.goto("/account/settings", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fsettings/);
});

test("profile redirects guests to login", async ({ page }) => {
  await page.goto("/profile", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);
});

test("guest add-card action redirects to register with next path", async ({ page }) => {
  await page.goto("/card-draw", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("Search word, translation, or example sentence").fill(E2E_CARD.searchTerm);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator('[data-card-deal-index="0"]').first()).toBeVisible();
  await expect(page.getByText("Click to flip").first()).toBeVisible();
  await expect(page.locator('[data-card-back-tier="A1"]').first()).toBeVisible();

  await page.getByRole("button", { name: E2E_CARD.flipName }).click();
  await expect(page.getByRole("heading", { name: E2E_CARD.term, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add" }).first().click();

  await expect(page).toHaveURL(/\/register\?next=%2Fcard-draw/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/card-draw");
});

test("guest quiz start redirects to register with learn path", async ({ page }) => {
  await page.addInitScript((cardId) => {
    window.localStorage.setItem(
      "kartlarla-dil:v3",
      JSON.stringify({
        state: {
          cards: [
            {
              cardId,
              status: "active",
              correctCount: 0,
              addedAt: new Date().toISOString(),
            },
          ],
          attempts: [],
        },
        version: 0,
      }),
    );
  }, E2E_CARD.id);

  await page.goto("/learn", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start practice" }).click();

  await expect(page).toHaveURL(/\/register\?next=%2Flearn/);
});

test("card details show examples and grammar without auth", async ({ page }) => {
  await page.goto("/card-draw", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder(/Search word/).fill(E2E_CARD.searchTerm);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Click to flip").first()).toBeVisible();
  await page.getByRole("button", { name: E2E_CARD.flipName }).click();
  await page.getByRole("button", { name: E2E_CARD.detailsName, exact: true }).click();

  const detailsDialog = page.getByRole("dialog", { name: /from Card details/ });

  await expect(detailsDialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "5 example uses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grammar guide" })).toBeVisible();
  await expect(detailsDialog.locator("article").first()).toContainText(E2E_CARD.term);
  await expect(page.getByText(/is useful in a clear sentence/)).toHaveCount(0);
  await expect(detailsDialog.getByText('What does "from" mean in this sentence?').first()).toBeVisible();
});

test("mobile navigation exposes the main sections", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("banner").getByRole("link", { name: "Draw cards" })).toBeVisible();

  const mobileNav = page.getByRole("navigation", { name: "Mobile main menu" });
  await expect(mobileNav.getByRole("link", { name: "Draw cards" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "My cards" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Learn", exact: true })).toBeVisible();
});
