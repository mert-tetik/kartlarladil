import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") console.log("console-error", message.text());
});
await page.goto("http://127.0.0.1:3000/login?next=%2Flearn", { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 60_000 });
await page.locator('input[type="email"]').fill("visual-count-transition@foxiesdeck.local");
await page.locator('input[type="password"]').fill("VisualTest123!");
await page.getByRole("button", { name: /log in/i }).click({ timeout: 120_000 });
await page.waitForTimeout(3_000);
console.log("after-login", page.url());
console.log("body", (await page.locator("body").innerText()).slice(0, 1800));
console.log("cookies", (await context.cookies()).map(({ name, value }) => {
  let subject = null;
  try {
    const decoded = JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64").toString("utf8"));
    const token = decoded.access_token?.split(".")[1];
    subject = token ? JSON.parse(Buffer.from(token, "base64url").toString("utf8")).sub : null;
  } catch {}
  return { name, subject };
}));
console.log("local-storage", await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).map(([key, value]) => [key, String(value).slice(0, 120)]))));
await page.goto("http://127.0.0.1:3000/learn?mode=active&language=en", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8_000);
console.log("learn", page.url());
console.log("learn-body", (await page.locator("body").innerText()).slice(0, 1800));
console.log("learn-markers", await page.locator("[data-quiz-count-selection], [data-learn-quiz-page], [data-learn-page]").evaluateAll((nodes) => nodes.map((node) => ({ tag: node.tagName, attrs: [...node.attributes].map((a) => [a.name, a.value]), rect: (() => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; })() }))));
await browser.close();
