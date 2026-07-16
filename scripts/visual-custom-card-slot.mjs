import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });

await page.goto("http://127.0.0.1:3000/visual-test-custom-card", { waitUntil: "domcontentloaded" });
await page.addStyleTag({
  content: `
    [data-mobile-auth-gateway] { display: none !important; }
    body:has([data-mobile-auth-gateway]) #main-content { display: block !important; }
  `,
});
await page.getByRole("button", { name: "Open custom card sheet" }).click();
await page.locator("#mobile-custom-term").waitFor({ state: "visible" });

const consent = page.getByRole("button", { name: /got it/i });
if (await consent.count()) await consent.click();

await page.screenshot({ path: "artifacts/custom-card-loop-normal.png", fullPage: true });
await page.locator("#mobile-custom-term").fill("house");
await page.locator("#mobile-custom-term + button").click({ force: true });
await page.waitForTimeout(80);

const emptyDuringReveal = await page.locator(".mobile-custom-card-loop-track > div").evaluateAll(
  (slots) => slots.filter((slot) => slot.childElementCount === 0).length,
);
await page.screenshot({ path: "artifacts/custom-card-loop-slot-empty.png", fullPage: true });
await page.waitForTimeout(1450);
await page.screenshot({ path: "artifacts/custom-card-loop-front.png", fullPage: true });

await page.locator("[data-mobile-custom-card-preview-back]").click();
await page.waitForTimeout(120);
await page.screenshot({ path: "artifacts/custom-card-loop-returning.png", fullPage: true });
await page.waitForTimeout(950);

const emptyAfterReturn = await page.locator(".mobile-custom-card-loop-track > div").evaluateAll(
  (slots) => slots.filter((slot) => slot.childElementCount === 0).length,
);
await page.screenshot({ path: "artifacts/custom-card-loop-restored.png", fullPage: true });
console.log(JSON.stringify({ emptyDuringReveal, emptyAfterReturn }));

await browser.close();
