import fs from "node:fs";

const AI_TRANSLATIONS_PATH = "scripts/data/ai-translations.json";
const KEY_WORDS_PATH = "scripts/data/master-key-words.json";
const OUTPUT_PATH = "src/data/card-seeds/master-list.ts";

const LOCALES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const FALLBACK_TRANSLATIONS = {
  by: {
    tr: "tarafından",
    de: "von",
    ru: "кем",
    fr: "par",
    es: "por",
    it: "da",
    pt: "por",
    nl: "door",
    pl: "przez",
    ar: "بواسطة",
    ja: "によって",
    ko: "에 의해",
    "zh-CN": "由",
  },
  CD: {
    tr: "CD",
    de: "CD",
    ru: "CD",
    fr: "CD",
    es: "CD",
    it: "CD",
    pt: "CD",
    nl: "CD",
    pl: "CD",
    ar: "سي دي",
    ja: "CD",
    ko: "CD",
    "zh-CN": "CD",
  },
};

const aiData = JSON.parse(fs.readFileSync(AI_TRANSLATIONS_PATH, "utf8"));
const keyWords = JSON.parse(fs.readFileSync(KEY_WORDS_PATH, "utf8"));
const keyWordMap = new Map(keyWords.map((entry) => [entry.word, entry]));

function normalizePartOfSpeech(type) {
  if (type === "ordinal number") return "number";
  return type;
}

const rows = aiData.map((entry) => {
  const keyWord = keyWordMap.get(entry.word);
  const aiTranslations = entry.aiTranslations ?? FALLBACK_TRANSLATIONS[entry.word] ?? {};

  const translations = Object.fromEntries(
    LOCALES.map((locale) => {
      let value = aiTranslations[locale] || entry.translations[locale] || "";
      value = value
        .replace(/\.\.\./g, "…")
        .replace(/(^[-\s]+|[-\s]+$)/g, "")
        .trim();
      return [locale, value];
    }),
  );

  const partOfSpeech = normalizePartOfSpeech(entry.type);
  const pronunciation = keyWord?.phon_n_am || keyWord?.phon_br || entry.word;

  return [
    entry.word, // englishKey
    entry.cefr, // tier
    "word", // termKind
    partOfSpeech,
    pronunciation,
    translations.tr,
    translations.en,
    translations.de,
    translations.ru,
    translations.fr,
    translations.es,
    translations.it,
    translations.pt,
    translations.nl,
    translations.pl,
    translations.ar,
    translations.ja,
    translations.ko,
    translations["zh-CN"],
  ];
});

const moduleSource = [
  'import type { CardSeedRow } from "./types";',
  "",
  "// Generated from Oxford 3000/5000 + OpenAI lemma translations.",
  `export const masterCardEntries = [`,
  ...rows.map((row) => `  ${JSON.stringify(row)},`),
  "] as const satisfies readonly CardSeedRow[];",
  "",
].join("\n");

fs.writeFileSync(OUTPUT_PATH, moduleSource, "utf8");

console.log(`Toplam satır: ${rows.length}`);
console.log(`Çıktı: ${OUTPUT_PATH}`);
