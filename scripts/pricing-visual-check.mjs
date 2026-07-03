import { chromium, devices } from 'playwright';
import fs from 'fs';

const outDir = '.tmp/pricing-visual-check';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const desktop = await chromium.launch();
const mobile = await chromium.launch();

const desktopPage = await desktop.newPage({ viewport: { width: 1280, height: 800 } });
const mobilePage = await mobile.newPage(devices['Pixel 7']);

for (const { name, page, urlSuffix } of [
  { name: 'pricing-desktop', page: desktopPage, urlSuffix: '' },
  { name: 'pricing-mobile', page: mobilePage, urlSuffix: '' },
  { name: 'pricing-twa-desktop', page: desktopPage, urlSuffix: '?twa' },
  { name: 'pricing-twa-mobile', page: mobilePage, urlSuffix: '?twa' },
]) {
  await page.goto(`http://localhost:3000/pricing${urlSuffix}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
}

await desktop.close();
await mobile.close();
console.log(`Screenshots saved to ${outDir}`);
