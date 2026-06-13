import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test("landing page explains the product", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kartlarla Dil" })).toBeVisible();
  await expect(page.getByText("İlk sürüm: İngilizce, Almanca, Rusça")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Kart çekmeye başla/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kayıt ol" })).toBeVisible();
  await expect(page.getByLabel("Desteklenen diller").getByLabel("İngilizce bayrağı")).toBeVisible();
  await expect(page.getByLabel("Desteklenen diller").getByLabel("Almanca bayrağı")).toBeVisible();
  await expect(page.getByLabel("Desteklenen diller").getByLabel("Rusça bayrağı")).toBeVisible();
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
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
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
    const verticalGap = firstRows[1]?.[0] ? Math.round(firstRows[1][0].top - firstRows[0][0].bottom) : 0;

    return {
      gapSpread: Math.max(...horizontalGaps) - Math.min(...horizontalGaps),
      rowCount: firstRows.length,
      rowLengths: firstRows.map((row) => row.length),
      verticalGap,
    };
  });
  expect(backdropLayoutMetrics.rowCount).toBe(2);
  expect(backdropLayoutMetrics.rowLengths).toEqual([12, 12]);
  expect(backdropLayoutMetrics.verticalGap).toBeGreaterThanOrEqual(14);
  expect(backdropLayoutMetrics.gapSpread).toBeLessThanOrEqual(1);
  await expect(heroBackdrop.getByText("İngilizce").first()).toBeVisible();
  await expect(heroBackdrop.getByText("Almanca").first()).toBeVisible();
  await expect(heroBackdrop.getByText("Rusça").first()).toBeVisible();
});

test("auth pages render public forms with password visibility toggles and preferences", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Giriş yap" }).first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();

  const loginPassword = page.getByLabel("Şifre", { exact: true });
  await expect(loginPassword).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Şifreyi göster" }).click();
  await expect(loginPassword).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Şifreyi gizle" }).click();
  await expect(loginPassword).toHaveAttribute("type", "password");

  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Kayıt ol" }).first()).toBeVisible();
  await expect(page.getByText("Hangi dili öğrenmek istiyorsun?")).toBeVisible();
  await expect(page.getByText("Hangi seviyeden başlayalım?")).toBeVisible();
  await expect(page.getByLabel("İngilizce bayrağı")).toBeVisible();
  await expect(page.getByLabel("Almanca bayrağı")).toBeVisible();
  await expect(page.getByLabel("Rusça bayrağı")).toBeVisible();
  await expect(page.locator('input[name="preferredLanguageCode"][value="en"]')).toBeChecked();
  await expect(page.locator('input[name="preferredTier"][value="A1"]')).toBeChecked();
  await expect(page.getByLabel("Görünen ad")).toBeVisible();
  await expect(page.getByLabel("Şifre", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.locator('input[name="next"]')).toHaveValue("/kart-cek");

  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Şifreyi sıfırla" }).first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("register preserves next and links back to login with the same next", async ({ page }) => {
  await page.goto("/register?next=%2Fkart-cek", { waitUntil: "domcontentloaded" });

  await expect(page.locator('input[name="next"]')).toHaveValue("/kart-cek");
  await expect(page.locator('a[href="/login?next=%2Fkart-cek"]').first()).toBeVisible();
});

test("card draw filters default to English A1 and remember user choices", async ({ page, isMobile }) => {
  await page.goto("/kart-cek", { waitUntil: "domcontentloaded" });

  if (isMobile) {
    await expect(page.getByRole("button", { name: /İngilizce/ })).toHaveAttribute("aria-haspopup", "listbox");
  } else {
    await expect(page.getByRole("button", { name: /İngilizce/ })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByRole("button", { name: "A1" })).toHaveAttribute("aria-pressed", "true");

  if (isMobile) {
    await page.getByRole("button", { name: /İngilizce/ }).click();
    await page.getByRole("option", { name: /Almanca/ }).click();
  } else {
    await page.getByRole("button", { name: /Almanca/ }).click();
  }
  await page.getByRole("button", { name: "B1" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });

  if (isMobile) {
    await expect(page.getByRole("button", { name: /Almanca/ })).toHaveAttribute("aria-haspopup", "listbox");
  } else {
    await expect(page.getByRole("button", { name: /Almanca/ })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByRole("button", { name: "B1" })).toHaveAttribute("aria-pressed", "true");
});

test("account settings redirects guests to login", async ({ page }) => {
  await page.goto("/account/settings", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fsettings/);
});

test("profile redirects guests to login", async ({ page }) => {
  await page.goto("/profil", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/login\?next=%2Fprofil/);
});

test("guest add-card action redirects to register with next path", async ({ page }) => {
  await page.goto("/kart-cek", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("Kelime, çeviri veya örnek cümle ara").fill("apple");
  await page.getByRole("button", { name: "Ara" }).click();
  await expect(page.locator('[data-card-deal-index="0"]').first()).toBeVisible();
  await expect(page.getByText("Çevirmek için tıkla").first()).toBeVisible();
  await expect(page.locator('[data-card-back-tier="A1"]').first()).toBeVisible();

  await page.getByRole("button", { name: "apple kartını çevir" }).click();
  await expect(page.getByRole("heading", { name: "apple", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ekle" }).first().click();

  await expect(page).toHaveURL(/\/register\?next=%2Fkart-cek/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/kart-cek");
});

test("guest quiz start redirects to register with learn path", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kartlarla-dil:v2",
      JSON.stringify({
        state: {
          cards: [
            {
              cardId: "en-a1-isim-apple",
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
  });

  await page.goto("/ogren", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Alıştırmayı başlat" }).click();

  await expect(page).toHaveURL(/\/register\?next=%2Fogren/);
});

test("card details show examples and grammar without auth", async ({ page }) => {
  await page.goto("/kart-cek", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder(/Kelime/).fill("apple");
  await page.getByRole("button", { name: "Ara" }).click();
  await expect(page.getByText("Çevirmek için tıkla").first()).toBeVisible();
  await page.getByRole("button", { name: "apple kartını çevir" }).click();
  await page.getByRole("button", { name: "apple detayları", exact: true }).click();

  const detailsDialog = page.getByRole("dialog", { name: /apple detayları/ });

  await expect(detailsDialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "5 örnek kullanım" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gramer anlatımı" })).toBeVisible();
  await expect(detailsDialog.locator("article").first()).toContainText("apple");
  await expect(page.getByText(/is useful in a clear sentence/)).toHaveCount(0);
  await expect(detailsDialog.getByText('Can you explain "apple" with one example?')).toBeVisible();
});

test("mobile navigation exposes the main sections", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("banner").getByRole("link", { name: "Kart çek" })).toBeVisible();

  const mobileNav = page.getByRole("navigation", { name: "Mobil ana menü" });
  await expect(mobileNav.getByRole("link", { name: "Kart çek" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Kartlarım" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Öğren", exact: true })).toBeVisible();
});
