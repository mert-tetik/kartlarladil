import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test("landing page explains the product", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kartlarla Dil" })).toBeVisible();
  await expect(page.getByText("İlk sürüm: İngilizce, Almanca, Rusça")).toBeVisible();
  await expect(page.getByRole("link", { name: /Kart çekmeye başla/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kayıt ol" })).toBeVisible();
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
  await expect(page.locator('input[name="next"]')).toHaveValue("/kesfet");

  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Şifreyi sıfırla" }).first()).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("register preserves next and links back to login with the same next", async ({ page }) => {
  await page.goto("/register?next=%2Fkesfet", { waitUntil: "domcontentloaded" });

  await expect(page.locator('input[name="next"]')).toHaveValue("/kesfet");
  await expect(page.locator('a[href="/login?next=%2Fkesfet"]').first()).toBeVisible();
});

test("discover filters default to English A1 and remember user choices", async ({ page }) => {
  await page.goto("/kesfet", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: /İngilizce/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "A1" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Almanca/ }).click();
  await page.getByRole("button", { name: "B1" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: /Almanca/ })).toHaveAttribute("aria-pressed", "true");
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
  await page.goto("/kesfet", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("Kelime, çeviri veya örnek cümle ara").fill("apple");
  await page.getByRole("button", { name: "Ara" }).click();
  await expect(page.getByText("Çevirmek için tıkla").first()).toBeVisible();
  await expect(page.locator('[data-card-back-tier="A1"]').first()).toBeVisible();

  await page.getByRole("button", { name: "apple kartını çevir" }).click();
  await expect(page.getByRole("heading", { name: "apple", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ekle" }).first().click();

  await expect(page).toHaveURL(/\/register\?next=%2Fkesfet/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/kesfet");
});

test("guest quiz start redirects to register with learn path", async ({ page }) => {
  await page.evaluate(() => {
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
  await page.goto("/kesfet", { waitUntil: "domcontentloaded" });

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

  const mobileNav = page.getByRole("navigation", { name: "Mobil ana menü" });
  await expect(mobileNav.getByRole("link", { name: "Keşfet" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Kartlarım" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Öğren", exact: true })).toBeVisible();
});
