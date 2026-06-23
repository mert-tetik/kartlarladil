import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login?next=%2Flearn`, { waitUntil: "networkidle" });
  console.log("Initial URL:", page.url());

  await page.locator('input[name="email"]').fill("visual-test@foxiesdeck.local");
  await page.locator('input[name="password"]').fill("VisualTest123!");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

  await page.waitForTimeout(3000);
  console.log("After submit URL:", page.url());

  const alert = await page.locator('[role="alert"]').first();
  if (await alert.isVisible().catch(() => false)) {
    console.log("Alert:", await alert.textContent());
  } else {
    console.log("No alert visible");
  }

  await page.screenshot({ path: ".tmp/debug-login.png" });
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
