import fs from "node:fs";
import path from "node:path";

const MUSE_DIR = path.join(process.cwd(), ".tmp", "muse-dictionaries");
const KEY_WORDS_PATH = path.join(process.cwd(), "scripts", "data", "master-key-words.json");
const OUTPUT_PATH = path.join(process.cwd(), "scripts", "data", "muse-translations.json");

const LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const MUSE_CODES = {
  tr: "tr",
  de: "de",
  ru: "ru",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  pl: "pl",
  ar: "ar",
  ja: "ja",
  ko: "ko",
  "zh-CN": "zh",
};

const keyWords = JSON.parse(fs.readFileSync(KEY_WORDS_PATH, "utf8"));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function loadDictionary(locale) {
  const code = MUSE_CODES[locale];
  const filename = path.join(MUSE_DIR, `en-${code}.txt`);
  const content = fs.readFileSync(filename, "utf8");
  const dictionary = new Map();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [source, target] = trimmed.split(/\s+/);
    const normalizedSource = normalize(source);
    if (!normalizedSource || dictionary.has(normalizedSource)) continue;
    dictionary.set(normalizedSource, normalize(target));
  }

  return dictionary;
}

const dictionaries = Object.fromEntries(LOCALES.map((locale) => [locale, loadDictionary(locale)]));
const results = [];
const missingReport = {};

for (const locale of LOCALES) {
  missingReport[locale] = 0;
}

for (const entry of keyWords) {
  const englishKey = normalize(entry.word);
  const translations = { en: entry.word };

  for (const locale of LOCALES) {
    const translated = dictionaries[locale].get(englishKey);
    if (!translated) {
      missingReport[locale] += 1;
    }
    translations[locale] = translated ?? "";
  }

  results.push({
    word: entry.word,
    cefr: entry.cefr,
    type: entry.type,
    translations,
  });
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

console.log(`Toplam key kelime: ${results.length}`);
console.log("MUSE eksik çeviri sayısı (locale başına):");
for (const [locale, count] of Object.entries(missingReport)) {
  const percent = ((count / results.length) * 100).toFixed(1);
  console.log(`  ${locale}: ${count} (%${percent})`);
}
console.log(`\nÇıktı: ${OUTPUT_PATH}`);
