import type { Language, LanguageCode, LocaleCode } from "@/types/domain";

export const LANGUAGE_CODES = [
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
] as const satisfies readonly LanguageCode[];

export const LOCALE_CODES = LANGUAGE_CODES satisfies readonly LocaleCode[];

export const LANGUAGES: Language[] = [
  { code: "tr", name: "Türkçe", nativeName: "Türkçe", accent: "#dc2626", flagCode: "tr", dir: "ltr" },
  { code: "en", name: "İngilizce", nativeName: "English", accent: "#2563eb", flagCode: "gb", dir: "ltr" },
  { code: "de", name: "Almanca", nativeName: "Deutsch", accent: "#0f766e", flagCode: "de", dir: "ltr" },
  { code: "ru", name: "Rusça", nativeName: "Русский", accent: "#b42318", flagCode: "ru", dir: "ltr" },
  { code: "fr", name: "Fransızca", nativeName: "Français", accent: "#1d4ed8", flagCode: "fr", dir: "ltr" },
  { code: "es", name: "İspanyolca", nativeName: "Español", accent: "#f59e0b", flagCode: "es", dir: "ltr" },
  { code: "it", name: "İtalyanca", nativeName: "Italiano", accent: "#16a34a", flagCode: "it", dir: "ltr" },
  { code: "pt", name: "Portekizce", nativeName: "Português", accent: "#059669", flagCode: "pt", dir: "ltr" },
  { code: "nl", name: "Felemenkçe", nativeName: "Nederlands", accent: "#ea580c", flagCode: "nl", dir: "ltr" },
  { code: "pl", name: "Lehçe", nativeName: "Polski", accent: "#e11d48", flagCode: "pl", dir: "ltr" },
  { code: "ar", name: "Arapça", nativeName: "العربية", accent: "#15803d", flagCode: "sa", dir: "rtl" },
  { code: "ja", name: "Japonca", nativeName: "日本語", accent: "#be123c", flagCode: "jp", dir: "ltr" },
  { code: "ko", name: "Korece", nativeName: "한국어", accent: "#1d4ed8", flagCode: "kr", dir: "ltr" },
  { code: "zh-CN", name: "Çince", nativeName: "简体中文", accent: "#b91c1c", flagCode: "cn", dir: "ltr" },
];

export const LANGUAGE_BY_CODE: Record<LanguageCode, Language> = Object.fromEntries(
  LANGUAGES.map((language) => [language.code, language]),
) as Record<LanguageCode, Language>;

export const LANGUAGE_NAMES: Record<LanguageCode, string> = Object.fromEntries(
  LANGUAGES.map((language) => [language.code, language.name]),
) as Record<LanguageCode, string>;

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode);
}

export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALE_CODES.includes(value as LocaleCode);
}

export function getLanguageName(code: LanguageCode) {
  return LANGUAGE_BY_CODE[code].name;
}

export function getLocaleDirection(code: LocaleCode) {
  return LANGUAGE_BY_CODE[code].dir;
}
