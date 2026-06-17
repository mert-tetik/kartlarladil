import { readFileSync, writeFileSync } from "node:fs";
import OpenAI from "openai";
import { DICTIONARIES } from "../src/i18n/dictionaries";
import { LANGUAGE_BY_CODE } from "../src/data/languages";
import type { LocaleCode } from "../src/types/domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TARGET_LOCALES: LocaleCode[] = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const en = DICTIONARIES.en;
const enKeys = Object.keys(en).sort();

const PRODUCT_NAME_KEYS = new Set([
  "nav.aiPractice",
  "page.aiPractice.title",
  "page.aiPractice.description",
]);

const groups = [
  { name: "Navigation & common", patterns: [/^nav\./, /^locale\./, /^common\./, /^language\./] },
  { name: "Tiers, ranks & examples", patterns: [/^tier\./, /^rank\./, /^partOfSpeech\./, /^example\./, /^home\.hero\./, /^home\.feature\./, /^home\.collection\./, /^home\.steps\./] },
  { name: "Home page", patterns: [/^home\.points\./, /^home\.rankRoad\./, /^home\.aiPractice\./, /^home\.ask\./, /^home\.cta\./, /^home\.review\./] },
  { name: "Page titles & descriptions", patterns: [/^page\./] },
  { name: "Auth login/register/onboarding", patterns: [/^auth\.login\./, /^auth\.register\./, /^auth\.onboarding\./, /^auth\.google\./] },
  { name: "Auth settings & messages", patterns: [/^auth\.reset\./, /^auth\.updatePassword\./, /^auth\.supabase\./, /^auth\.preference\./, /^auth\.password\./, /^auth\.profile\./, /^auth\.delete\./, /^auth\.accountMenu$/, /^auth\.logout$/, /^auth\.message\./] },
  { name: "Auth validation", patterns: [/^auth\.validation\./] },
  { name: "Account & theme", patterns: [/^account\.subscription\./, /^theme\./] },
  { name: "Cards", patterns: [/^cards\./] },
  { name: "Inventory", patterns: [/^inventory\./] },
  { name: "Quiz", patterns: [/^quiz\./] },
  { name: "Profile & rank", patterns: [/^profile\./, /^rank\./] },
  { name: "AI Practice chat", patterns: [/^aiPractice\.chat\./] },
  { name: "Ask", patterns: [/^ask\./] },
  { name: "Pricing, limits & legal", patterns: [/^pricing\./, /^limit\./, /^legal\./, /^footer\./, /^cookies\./, /^register\./] },
];

function groupKeys(keys: string[]) {
  const grouped: Record<string, string[]> = {};
  const matched = new Set<string>();
  for (const group of groups) {
    const groupKeys = keys.filter((k) => group.patterns.some((p) => p.test(k)));
    grouped[group.name] = groupKeys;
    groupKeys.forEach((k) => matched.add(k));
  }
  grouped["Other"] = keys.filter((k) => !matched.has(k));
  return grouped;
}

function buildPrompt(locale: LocaleCode, localeName: string, entries: { key: string; source: string; group: string }[]) {
  const grouped = groupKeys(entries.map((e) => e.key));
  let body = "";
  for (const [groupName, keys] of Object.entries(grouped)) {
    if (keys.length === 0) continue;
    body += `\n// ${groupName}\n`;
    for (const key of keys) {
      const entry = entries.find((e) => e.key === key)!;
      body += `${JSON.stringify(key)}: ${JSON.stringify(entry.source)},\n`;
    }
  }

  const extra: Record<string, string> = {
    ar: "Use Modern Standard Arabic that sounds natural for a web app. Keep UI labels concise.",
    ja: "Use natural Japanese for a modern web app. Keep labels concise; omit subjects where natural.",
    ko: "Use natural Korean for a modern web app. Keep labels concise and polite but not overly formal.",
    "zh-CN": "Use natural Simplified Chinese for a modern web app. Keep labels concise.",
  };

  return `You are localizing the UI of FoxiesDeck, a language-learning web app that uses collectible vocabulary cards, quizzes, ranks, points, AI practice chat, and subscriptions.

Translate the following English UI strings into ${localeName}. The strings are grouped by UI area for context.

Rules:
1. Keep placeholders exactly as written: {count}, {language}, {points}, {rank}, {confirmation}, {answer}, {required}, {term}, {tier}, {email}, {year}, {rate}, {price}.
2. Keep the product names "FoxiesDeck", "AI Practice", "Ask", and "Foxy" in English. Do not translate them.
3. Keep HTML tags, URLs, and email addresses unchanged.
4. Use natural, friendly, concise language appropriate for a modern web app.
5. Do not add, remove, or rename keys.
6. ${extra[locale] ?? "Use natural, friendly, concise language appropriate for a modern web app."}
7. Return strictly valid JSON in this exact flat format: {"key": "translated value", ...}

${body}`;
}

async function translateLocale(locale: LocaleCode) {
  const dict = DICTIONARIES[locale];
  const missingKeys = enKeys.filter((k) => (dict as Record<string, string>)[k] === (en as Record<string, string>)[k]);
  if (missingKeys.length === 0) {
    console.log(`[${locale}] no missing keys`);
    return;
  }

  console.log(`[${locale}] translating ${missingKeys.length} keys...`);
  const entries = missingKeys.map((key) => {
    const group = groups.find((g) => g.patterns.some((p) => p.test(key)))?.name ?? "Other";
    return { key, source: (en as Record<string, string>)[key], group };
  });

  const localeName = LANGUAGE_BY_CODE[locale].nativeName;
  const prompt = buildPrompt(locale, localeName, entries);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response for ${locale}`);

  const translated = JSON.parse(content) as Record<string, string>;

  // Validate all keys returned
  for (const key of missingKeys) {
    if (!(key in translated)) {
      console.warn(`[${locale}] missing translation for ${key}`);
    }
  }

  // Merge translations into locale file
  const filePath = `src/i18n/locales/${locale}.ts`;
  const fileContent = readFileSync(filePath, "utf-8");
  let updated = fileContent;

  for (const key of missingKeys) {
    const value = translated[key] ?? (en as Record<string, string>)[key];
    // Keep product names in English for specific keys
    const finalValue = PRODUCT_NAME_KEYS.has(key) ? (en as Record<string, string>)[key] : value;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    updated = updated.replace(new RegExp(`(\\s+"${escapedKey}": )"[^"]*"`, "g"), `$1${JSON.stringify(finalValue)}`);
  }

  writeFileSync(filePath, updated);
  console.log(`[${locale}] wrote ${missingKeys.length} translations`);
}

async function main() {
  for (const locale of TARGET_LOCALES) {
    await translateLocale(locale);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
