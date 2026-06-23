import { chromium, devices } from "playwright";

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 7"],
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/card-draw", { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);

  const gotIt = page.locator('button:has-text("Got it")');
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(500);
  }

  // Default state (keyboard closed)
  await page.screenshot({ path: ".tmp/visual-keyboard-card-draw.png", fullPage: false });
  console.log("Screenshot: .tmp/visual-keyboard-card-draw.png");

  let keyboardHeight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height"),
  );
  console.log("--keyboard-height (closed):", keyboardHeight);

  // Simulate keyboard open by overriding the CSS variable
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--keyboard-height", "300px");
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: ".tmp/visual-keyboard-card-draw-open.png", fullPage: false });
  console.log("Screenshot: .tmp/visual-keyboard-card-draw-open.png");

  keyboardHeight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height"),
  );
  console.log("--keyboard-height (simulated open):", keyboardHeight);

  await browser.close();
}

run();
