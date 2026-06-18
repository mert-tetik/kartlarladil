import fs from "node:fs";
import OpenAI from "openai";

const INPUT_PATH = "scripts/data/ai-translations.json";
const OUTPUT_PATH = "scripts/data/ai-translations.json";
const PARTIAL_PATH = "scripts/data/ai-translations-fix-partial.json";
const BATCH_SIZE = 10;
const CONCURRENCY = 3;
const MAX_RETRIES = 3;

const LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

loadEnv(".env.local");

const openai = new OpenAI();

const entries = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));

function isBad(value) {
  if (!value || typeof value !== "string") return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.includes("/") || trimmed.includes("\\")) return true;
  return false;
}

function missingLocales(entry) {
  return LOCALES.filter((locale) => isBad(entry.aiTranslations?.[locale]));
}

const toFix = entries.filter((entry) => missingLocales(entry).length > 0);

console.log(`Toplam kayıt: ${entries.length}, düzeltilmesi gereken: ${toFix.length}`);

let results = [];
if (fs.existsSync(PARTIAL_PATH)) {
  results = JSON.parse(fs.readFileSync(PARTIAL_PATH, "utf8"));
  console.log(`Kaldığı yerden devam ediliyor: ${results.length} kayıt.`);
}

const fixedWords = new Set(results.map((entry) => entry.word));
const remaining = toFix.filter((entry) => !fixedWords.has(entry.word));

const batches = chunk(remaining, BATCH_SIZE);

for (let batchIndex = 0; batchIndex < batches.length; batchIndex += CONCURRENCY) {
  const currentBatches = batches.slice(batchIndex, batchIndex + CONCURRENCY);

  const promises = currentBatches.map(async (batch, offset) => {
    const globalIndex = results.length + batchIndex * BATCH_SIZE + offset * BATCH_SIZE;
    const start = Math.min(globalIndex + 1, toFix.length);
    const end = Math.min(globalIndex + BATCH_SIZE, toFix.length);

    console.log(`İşleniyor: ${start}-${end} / ${toFix.length}`);

    const words = batch.map((entry) => ({ word: entry.word, type: entry.type, cefr: entry.cefr }));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const translated = await translateBatch(words);
        return batch.map((entry) => {
          const updates = {};
          for (const locale of missingLocales(entry)) {
            const value = translated[entry.word]?.[locale];
            if (value && !isBad(value)) {
              updates[locale] = value.trim().replace(/\.{3}/g, "…");
            }
          }
          return {
            ...entry,
            aiTranslations: { ...entry.aiTranslations, ...updates },
          };
        });
      } catch (error) {
        console.error(`Batch ${start}-${end} deneme ${attempt} hatası:`, error.message);
        if (attempt === MAX_RETRIES) {
          console.error(`Batch ${start}-${end} başarısız oldu, atlanıyor.`);
          return batch.map((entry) => ({ ...entry }));
        }
        await sleep(1000 * attempt);
      }
    }
  });

  const batchResults = await Promise.all(promises);
  results.push(...batchResults.flat());

  fs.writeFileSync(PARTIAL_PATH, JSON.stringify(results, null, 2));
  console.log(`Kaydedildi: ${results.length} / ${toFix.length}`);
}

const resultByWord = new Map(results.map((entry) => [entry.word, entry]));
const mergedEntries = entries.map((entry) => resultByWord.get(entry.word) ?? entry);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedEntries, null, 2));
if (fs.existsSync(PARTIAL_PATH)) fs.unlinkSync(PARTIAL_PATH);

const stillBad = mergedEntries.filter((entry) => missingLocales(entry).length > 0);
console.log(`\nTamamlandı. Hala eksik çeviri olan kelime: ${stillBad.length}`);
if (stillBad.length) {
  console.log(stillBad.map((e) => e.word).join(", "));
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(words) {
  const localeList = LOCALES.map((locale) => `"${locale}"`).join(", ");
  return [
    `For each English word below, provide the dictionary/lemma (root) form translation in these languages: ${localeList}.`,
    `Return a JSON object where keys are English words and values are objects with locale codes (${LOCALES.join(", ")}) as keys and translations as values.`,
    `Each translation MUST be a single non-empty word or short phrase. Do NOT use slashes, alternatives, or abbreviations. Choose the single most common equivalent.`,
    `Use Arabic script for Arabic, Kanji/Hiragana for Japanese, Hangul for Korean, Simplified Chinese for Chinese. Do not provide romanizations.`,
    `\nWords:\n${JSON.stringify(words)}`,
  ].join("\n");
}

async function translateBatch(words) {
  const prompt = buildPrompt(words);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert multilingual lexicographer. For each English word, return dictionary/lemma (root) form translations in 13 languages. Return valid JSON only. Every locale value must be present and non-empty.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("JSON parse hatası, content:", content.slice(0, 500));
    throw error;
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
