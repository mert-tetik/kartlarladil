import { LANGUAGE_CODES, matchSupportedLocale } from "@/data/languages";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export function getBrowserLocale(): LocaleCode {
  return matchSupportedLocale(navigator.language) ?? "en";
}

function pickRandomLanguage(exclude: LanguageCode): LanguageCode {
  const candidates = LANGUAGE_CODES.filter((code) => code !== exclude);
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? "en";
}

export function resolveMobileLandingLanguage(
  selectedCardLanguage: LanguageCode,
  currentSiteLocale: LocaleCode,
  browserLocale?: LocaleCode,
): { siteLocale: LocaleCode; cardLanguage: LanguageCode } {
  if (selectedCardLanguage !== currentSiteLocale) {
    return { siteLocale: currentSiteLocale, cardLanguage: selectedCardLanguage };
  }

  const fallbackBrowserLocale = browserLocale ?? getBrowserLocale();
  if (fallbackBrowserLocale !== selectedCardLanguage) {
    return { siteLocale: fallbackBrowserLocale, cardLanguage: selectedCardLanguage };
  }

  return {
    siteLocale: currentSiteLocale,
    cardLanguage: pickRandomLanguage(currentSiteLocale),
  };
}
