import fs from "node:fs";
import OpenAI from "openai";

const LOCALES = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const SOURCE = {
  "limit.activeCardLimitDescription": "The free plan allows up to 20 active cards at a time. Remove an existing card or upgrade your plan to add a new one.",
  "limit.activeCardLimitTitle": "Active card quota full",
  "limit.aiDailyLimitDescription": "You’ve used all 10 AI messages included in the free plan for today. Come back tomorrow or upgrade your plan to send more.",
  "limit.aiDailyLimitTitle": "Daily AI message quota full",
  "limit.aiMonthlyLimitDescription": "You’ve used all 200 AI messages included in the free plan this month. Wait until next month or upgrade your plan to send more.",
  "limit.aiMonthlyLimitTitle": "Monthly AI message quota full",
  "limit.defaultDescription": "This action is outside your current plan’s limits. Upgrade your plan to unlock more.",
  "limit.defaultTitle": "Plan limit reached",
  "limit.learnedCardLimitDescription": "The free plan lets you learn up to 50 cards in total. Reset some learned cards or upgrade your plan to learn more.",
  "limit.learnedCardLimitTitle": "Learned card quota full",
  "limit.cardAlreadyActiveTitle": "This card is already active",
  "limit.cardAlreadyActiveDescription": "This card is already in your active cards. You can’t add the same card twice.",
  "limit.cardAlreadyLearnedTitle": "This card is already learned",
  "limit.cardAlreadyLearnedDescription": "This card is already in your learned cards. You can’t add the same card twice.",
};

loadEnv(".env.local");

const openai = new OpenAI();

async function translate() {
  const prompt = [
    "Translate the following UI strings from English into each target locale.",
    "Target locales: " + LOCALES.map((l) => `"${l}"`).join(", ") + ".",
    "Return a JSON object where top-level keys are locale codes and values are objects mapping the original string keys to translations.",
    "Keep the tone concise, friendly, and clear. These are in-app subscription/limit messages.",
    "Preserve any apostrophe/quote style naturally for the locale.",
    "\nSource strings:\n" + JSON.stringify(SOURCE, null, 2),
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert UI localization assistant. Return only valid JSON matching the requested structure. Do not include markdown or explanations.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  const translations = JSON.parse(content);

  for (const locale of LOCALES) {
    const filePath = `src/i18n/locales/${locale}.ts`;
    let fileContent = fs.readFileSync(filePath, "utf8");
    const localeTranslations = translations[locale];

    if (!localeTranslations) {
      console.warn(`No translations returned for ${locale}`);
      continue;
    }

    for (const [key, value] of Object.entries(localeTranslations)) {
      const escapedValue = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const regex = new RegExp(`  "${key.replace(/\./g, "\\.")}": "[^"]*"`, "g");
      const replacement = `  "${key}": "${escapedValue}"`;
      const newContent = fileContent.replace(regex, replacement);
      if (newContent === fileContent) {
        console.warn(`Key not found in ${locale}: ${key}`);
      }
      fileContent = newContent;
    }

    fs.writeFileSync(filePath, fileContent, "utf8");
    console.log(`Updated ${filePath}`);
  }
}

function loadEnv(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim().replace(/^\uFEFF/, "");
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

translate().catch((error) => {
  console.error(error);
  process.exit(1);
});
