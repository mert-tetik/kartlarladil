import { matchSupportedLocale } from "@/data/languages";
import type { LanguageCode, LocaleCode } from "@/types/domain";

const NATIVE_LANGUAGE_BY_COUNTRY: Record<string, LocaleCode> = {
  AR: "es",
  AT: "de",
  AU: "en",
  BR: "pt",
  CA: "en",
  CH: "de",
  CL: "es",
  CN: "zh-CN",
  CO: "es",
  DE: "de",
  ES: "es",
  FR: "fr",
  GB: "en",
  IE: "en",
  IT: "it",
  JP: "ja",
  KR: "ko",
  MX: "es",
  NL: "nl",
  NZ: "en",
  PL: "pl",
  PT: "pt",
  RU: "ru",
  TR: "tr",
  US: "en",
};

export function getOnboardingLanguageDefaults(countryCode: string | null | undefined, deviceLocale: string | null | undefined) {
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? "";
  const nativeLanguage = NATIVE_LANGUAGE_BY_COUNTRY[normalizedCountryCode] ?? matchSupportedLocale(deviceLocale) ?? "en";

  return {
    preferredUiLocale: nativeLanguage,
    preferredLanguageCode: (nativeLanguage === "en" ? "es" : "en") as LanguageCode,
  };
}
