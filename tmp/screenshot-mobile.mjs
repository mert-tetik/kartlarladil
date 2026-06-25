import { chromium, devices } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:3000";

async function capture(deviceName, suffix) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices[deviceName],
    locale: "en-US",
  });

  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("foxiesdeck-cookie-notice-dismissed", "true");
    } catch {
      // ignore
    }
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `tmp/landing-${suffix}.png` });
  await page.close();

  const page2 = await context.newPage();
  await page2.goto(`${baseUrl}/card-draw?language=en&tier=A1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page2.waitForTimeout(10000);
  await page2.screenshot({ path: `tmp/card-draw-${suffix}.png` });
  await page2.close();

  await browser.close();
}

await capture("iPhone SE", "iphone-se");
await capture("Pixel 7", "pixel-7");
