import { chromium } from "playwright";
import fs from "fs";

const outDir = "tmp-videos";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  recordVideo: { dir: outDir, size: { width: 375, height: 667 } },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:3000/card-draw", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const gotIt = page.locator('button:has-text("Got it")');
if (await gotIt.count() > 0) await gotIt.click();
await page.click('button:has-text("Draw 5")');
await page.waitForTimeout(1200);
await page.click('button:has-text("Draw 10")');
await page.waitForTimeout(1200);
await context.close();
await browser.close();

const videos = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
if (videos.length > 0) {
  const src = `${outDir}/${videos[0]}`;
  const dest = "tmp-shake-video.webm";
  fs.renameSync(src, dest);
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log("Video saved to", dest);
} else {
  console.log("No video found");
}
