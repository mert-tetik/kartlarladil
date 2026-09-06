import type { LocaleCode } from "@/types/domain";

const SUPER_WATER_LOCALES = new Set<LocaleCode>([
  "en",
  "tr",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
]);

// These letters are not decomposed into a base Latin character by Unicode NFD.
const ASCII_CHARACTER_REPLACEMENTS: Record<string, string> = {
  "\u00df": "ss",
  "\u1e9e": "SS",
  "\u00e6": "ae",
  "\u00c6": "AE",
  "\u0153": "oe",
  "\u0152": "OE",
  "\u00f8": "o",
  "\u00d8": "O",
  "\u0142": "l",
  "\u0141": "L",
  "\u0111": "d",
  "\u0110": "D",
  "\u00f0": "d",
  "\u00d0": "D",
  "\u00fe": "th",
  "\u00de": "TH",
  "\u0131": "i",
  "\u0130": "I",
};

const SPECIAL_LATIN_CHARACTER_PATTERN = /[\u00df\u1e9e\u00e6\u00c6\u0153\u0152\u00f8\u00d8\u0142\u0141\u0111\u0110\u00f0\u00d0\u00fe\u00de\u0131\u0130]/g;

// Super Water only contains the English alphabet. Latin UI locales are displayed
// with ASCII equivalents; non-Latin locales retain the normal application font.
export function canUseSuperWater(locale: LocaleCode) {
  return SUPER_WATER_LOCALES.has(locale);
}

export function formatSuperWaterText(locale: LocaleCode, text: string) {
  if (!canUseSuperWater(locale)) {
    return text;
  }

  return text
    .replace(SPECIAL_LATIN_CHARACTER_PATTERN, (character) => ASCII_CHARACTER_REPLACEMENTS[character] ?? character)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Formats a localized label that is rendered in uppercase with Super Water.
 * Uppercasing must happen before ASCII conversion so Turkish casing does not
 * turn a supported ASCII `I` into an unsupported dotted `İ`.
 */
export function formatSuperWaterUppercaseText(locale: LocaleCode, text: string) {
  return formatSuperWaterText(locale, text.toLocaleUpperCase(locale));
}
