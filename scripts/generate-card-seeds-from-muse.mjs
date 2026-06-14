import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const CACHE_DIR = path.join(PROJECT_ROOT, ".tmp", "muse-dictionaries");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "src", "data", "card-seeds");
const BASE_URL = "https://dl.fbaipublicfiles.com/arrival/dictionaries";
const CARDS_PER_LANGUAGE = 2000;
const TIERS = ["A1", "A2", "B1", "B2", "C1"];
const SINGLE_WORD_PATTERN = /^[\p{L}\p{M}]+$/u;
const LOCALES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const MUSE_CODES = {
  tr: "tr",
  en: "en",
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

await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const enToLocale = new Map();
const localeToEn = new Map();

for (const locale of LOCALES) {
  if (locale === "en") {
    continue;
  }

  enToLocale.set(locale, await loadDictionary("en", MUSE_CODES[locale]));
  localeToEn.set(locale, await loadDictionary(MUSE_CODES[locale], "en"));
}

for (const language of LOCALES) {
  const rows = buildRowsForLanguage(language);

  if (rows.length < CARDS_PER_LANGUAGE) {
    throw new Error(`${language} için ${CARDS_PER_LANGUAGE} tek kelime bulunamadı. Bulunan: ${rows.length}`);
  }

  await writeLanguageModule(language, rows.slice(0, CARDS_PER_LANGUAGE));
  console.log(`${language}: ${CARDS_PER_LANGUAGE} seed yazıldı.`);
}

await writeIndexModule();

async function loadDictionary(source, target) {
  const filename = path.join(CACHE_DIR, `${source}-${target}.txt`);

  try {
    await fs.access(filename);
  } catch {
    const response = await fetch(`${BASE_URL}/${source}-${target}.txt`, {
      headers: { "User-Agent": "foxiesdeck-seed-generator/0.1" },
    });

    if (!response.ok) {
      throw new Error(`${source}-${target} sözlüğü indirilemedi: ${response.status}`);
    }

    await fs.writeFile(filename, await response.text(), "utf8");
  }

  const content = await fs.readFile(filename, "utf8");
  const dictionary = new Map();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const [sourceTerm, targetTerm] = trimmed.split(/\s+/);
    const normalizedSource = normalizeDictionaryValue(sourceTerm);
    const normalizedTarget = normalizeDictionaryValue(targetTerm);

    if (!normalizedSource || !normalizedTarget || dictionary.has(normalizedSource)) {
      continue;
    }

    dictionary.set(normalizedSource, normalizedTarget);
  }

  return dictionary;
}

function buildRowsForLanguage(language) {
  const rows = [];
  const seenTerms = new Set();
  const sourcePairs = language === "en" ? buildEnglishSourcePairs() : [...localeToEn.get(language).entries()];

  for (const [rawTerm, rawEnglishPivot] of sourcePairs) {
    const term = normalizeDictionaryValue(rawTerm);
    const englishPivot = normalizeDictionaryValue(rawEnglishPivot).toLocaleLowerCase("en");

    if (!isSingleWord(term) || !isSingleWord(englishPivot)) {
      continue;
    }

    const termKey = term.toLocaleLowerCase("en");

    if (seenTerms.has(termKey)) {
      continue;
    }

    const translations = buildTranslations(language, term, englishPivot);

    if (!translations) {
      continue;
    }

    seenTerms.add(termKey);
    rows.push([
      term,
      tierForIndex(rows.length),
      "word",
      "kelime",
      term,
      ...LOCALES.map((locale) => translations[locale]),
    ]);

    if (rows.length >= CARDS_PER_LANGUAGE) {
      break;
    }
  }

  return rows;
}

function buildEnglishSourcePairs() {
  const firstTarget = enToLocale.get("tr");
  return [...firstTarget.keys()].map((englishTerm) => [englishTerm, englishTerm]);
}

function buildTranslations(language, term, englishPivot) {
  const translations = { en: englishPivot };

  for (const locale of LOCALES) {
    if (locale === "en") {
      continue;
    }

    const translated = enToLocale.get(locale).get(englishPivot);

    if (!translated) {
      return null;
    }

    translations[locale] = translated;
  }

  translations[language] = term;

  return translations;
}

function tierForIndex(index) {
  return TIERS[Math.min(TIERS.length - 1, Math.floor(index / (CARDS_PER_LANGUAGE / TIERS.length)))];
}

function normalizeDictionaryValue(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/_/g, " ")
    .trim();
}

function isSingleWord(value) {
  return SINGLE_WORD_PATTERN.test(value);
}

async function writeLanguageModule(language, rows) {
  const variableName = `${toIdentifier(language)}SeedRows`;
  const moduleSource = [
    'import type { CardSeedRow } from "./types";',
    "",
    "// Generated from MUSE bilingual dictionaries. See docs/LEXICON_SOURCES.md.",
    `export const ${variableName} = [`,
    ...rows.map((row) => `  ${JSON.stringify(row)},`),
    "] as const satisfies readonly CardSeedRow[];",
    "",
  ].join("\n");

  await fs.writeFile(path.join(OUTPUT_DIR, `${language}.ts`), moduleSource, "utf8");
}

async function writeIndexModule() {
  const imports = LOCALES.map(
    (language) => `import { ${toIdentifier(language)}SeedRows } from "./${language}";`,
  );
  const modules = LOCALES.map(
    (language) => `  { language: ${JSON.stringify(language)}, rows: ${toIdentifier(language)}SeedRows },`,
  );
  const source = [
    ...imports,
    'import type { CardSeedModule } from "./types";',
    "",
    "export const CARD_SEED_MODULES = [",
    ...modules,
    "] as const satisfies readonly CardSeedModule[];",
    "",
  ].join("\n");

  await fs.writeFile(path.join(OUTPUT_DIR, "index.ts"), source, "utf8");
}

function toIdentifier(language) {
  return language.replace(/-([a-z])/gi, (_, char) => char.toUpperCase()).replace(/^[a-z]/, (char) => char.toLowerCase());
}
