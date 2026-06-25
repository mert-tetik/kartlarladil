import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/visual-check");

const devices = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "pixel-7", width: 412, height: 915 },
];

const pages = [
  { name: "landing", path: "/" },
  { name: "card-draw", path: "/card-draw?language=en&tier=A1" },
  { name: "learn", path: "/learn?mode=active&language=en" },
];

async function capture(browser, device, pageInfo) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    userAgent:
      device.name === "iphone-se"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        : "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36",
  });

  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:3000${pageInfo.path}`, { waitUntil: "networkidle", timeout: 60000 });

  if (pageInfo.name === "landing") {
    await page.waitForSelector('[data-rank-icon-button] img', { timeout: 15000 });
    const cookieButton = page.locator('button:has-text("Got it")');
    if (await cookieButton.isVisible().catch(() => false)) {
      await cookieButton.click();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
  } else if (pageInfo.name === "card-draw") {
    await page.waitForSelector('[data-card-draw-search-input]', { timeout: 15000 });
    await page.waitForTimeout(500);
  } else if (pageInfo.name === "learn") {
    await page.waitForSelector('text=/Start|Begin|Learn|Quiz/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const fileName = `${pageInfo.name}-${device.name}.png`;
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });
  console.log(`Captured ${fileName}`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const device of devices) {
    for (const pageInfo of pages) {
      await capture(browser, device, pageInfo);
    }
  }
  await browser.close();
})();
