import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), ".tmp", "visual-check");

const pages = [
  { name: "landing", path: "/", scroll: true },
  { name: "pricing", path: "/pricing" },
  { name: "my-cards", path: "/my-cards" },
  { name: "learn", path: "/learn" },
];

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", ...devices["iPhone SE"].viewport },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const { name, path: route, scroll } of pages) {
      const url = `${BASE_URL}${route}`;
      try {
        await page.goto(url, { waitUntil: "networkidle" });
        if (scroll) {
          await page.evaluate(async () => {
            await new Promise((resolve) => {
              let totalHeight = 0;
              const distance = 300;
              const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                  clearInterval(timer);
                  window.scrollTo(0, 0);
                  resolve(undefined);
                }
              }, 50);
            });
          });
          await page.waitForTimeout(300);
        }
        const fileName = `${name}-${viewport.name}.png`;
        await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: true });
        console.log(`Screenshot: ${fileName}`);
      } catch (error) {
        console.error(`Failed ${url}:`, error.message);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
