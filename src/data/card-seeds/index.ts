import { masterCardEntries } from "./master-list";
import { CARD_SEED_LOCALE_ORDER } from "./types";
import type { CardSeedModule } from "./types";

const LOCALES = [
  "tr",
  "en",
  "de",
  "ru",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ar",
  "ja",
  "ko",
  "zh-CN",
] as const;
  
function getLocaleIndex(locale: (typeof LOCALES)[number]) {
  return CARD_SEED_LOCALE_ORDER.indexOf(locale) + 5;
}

function rowsForLanguage(language: (typeof LOCALES)[number]) {
  const index = getLocaleIndex(language);
  const seen = new Set<string>();

  return masterCardEntries.filter((row) => {
    const term = String(row[index] ?? "").trim().toLowerCase();
    if (!term || seen.has(term)) return false;
    seen.add(term);
    return true;
  });
}

export const CARD_SEED_MODULES: readonly CardSeedModule[] = LOCALES.map((language) => ({
  language,
  rows: rowsForLanguage(language),
}));
