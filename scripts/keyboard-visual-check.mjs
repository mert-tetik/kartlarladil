import { chromium, devices } from "playwright";

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 7"],
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/card-draw", { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);

  // Dismiss cookie notice if present
  const gotIt = page.locator('button:has-text("Got it")');
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: ".tmp/visual-keyboard-card-draw.png", fullPage: false });
  console.log("Screenshot: .tmp/visual-keyboard-card-draw.png");

  const keyboardHeight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height"),
  );
  console.log("--keyboard-height:", keyboardHeight);

  await browser.close();
}

run();
