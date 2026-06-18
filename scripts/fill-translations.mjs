import fs from "node:fs";
import OpenAI from "openai";

const INPUT_PATH = "scripts/data/muse-translations.json";
const OUTPUT_PATH = "scripts/data/ai-translations.json";
const PARTIAL_PATH = "scripts/data/ai-translations-partial.json";
const BATCH_SIZE = 50;
const CONCURRENCY = 3;

const LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

loadEnv(".env.local");

const openai = new OpenAI();

const entries = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));

let results = [];
if (fs.existsSync(PARTIAL_PATH)) {
  results = JSON.parse(fs.readFileSync(PARTIAL_PATH, "utf8"));
  console.log(`Kaldığı yerden devam ediliyor: ${results.length} kayıt yüklendi.`);
}

const remaining = entries.slice(results.length);
const batches = chunk(remaining, BATCH_SIZE);

console.log(`Toplam: ${entries.length} kelime, kalan: ${remaining.length}, batch: ${batches.length}`);

for (let batchIndex = 0; batchIndex < batches.length; batchIndex += CONCURRENCY) {
  const currentBatches = batches.slice(batchIndex, batchIndex + CONCURRENCY);

  const promises = currentBatches.map(async (batch, offset) => {
    const globalIndex = results.length + batchIndex * BATCH_SIZE + offset * BATCH_SIZE;
    const start = globalIndex + 1;
    const end = Math.min(globalIndex + BATCH_SIZE, entries.length);
    const words = batch.map((entry) => ({ word: entry.word, type: entry.type }));
    const hintsByWord = Object.fromEntries(batch.map((entry) => [entry.word, entry.translations]));

    console.log(`İşleniyor: ${start}-${end} / ${entries.length}`);

    try {
      const translated = await translateBatch(words, hintsByWord);
      return batch.map((entry) => ({
        ...entry,
        aiTranslations: translated[entry.word] ?? null,
      }));
    } catch (error) {
      console.error(`Batch ${start}-${end} hatası:`, error.message);
      return batch.map((entry) => ({
        ...entry,
        aiTranslations: null,
      }));
    }
  });

  const batchResults = await Promise.all(promises);
  results.push(...batchResults.flat());

  fs.writeFileSync(PARTIAL_PATH, JSON.stringify(results, null, 2));
  console.log(`Kaydedildi: ${results.length} / ${entries.length}`);
}

fs.renameSync(PARTIAL_PATH, OUTPUT_PATH);
console.log(`\nTamamlandı: ${OUTPUT_PATH}`);

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function buildPrompt(words, hintsByWord) {
  const localeList = LOCALES.map((locale) => `"${locale}"`).join(", ");

  const wordObjects = words.map((word) => {
    const hints = hintsByWord[word.word] ?? {};
    const filteredHints = Object.fromEntries(
      Object.entries(hints).filter(([locale]) => LOCALES.includes(locale) && hints[locale]),
    );
    return {
      word: word.word,
      type: word.type,
      hints: filteredHints,
    };
  });

  return [
    `For each English word below, provide the dictionary/lemma (root) form translation in these languages: ${localeList}.`,
    `Return a JSON object where keys are English words and values are objects with locale codes (${LOCALES.join(", ")}) as keys and translations as values.`,
    `Use the provided MUSE hints only as a guide; correct them to proper lemma forms.`,
    `If a word has multiple common meanings, choose the most common one.`,
    `\nWords:\n${JSON.stringify(wordObjects)}`,
  ].join("\n");
}

async function translateBatch(words, hintsByWord) {
  const prompt = buildPrompt(words, hintsByWord);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert multilingual lexicographer. For each English word, return dictionary/lemma (root) form translations in 13 languages. Use Arabic script for Arabic, Kanji/Hiragana for Japanese, Hangul for Korean, Simplified Chinese for Chinese. Do not provide romanizations or explanations. Return valid JSON only.",
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
