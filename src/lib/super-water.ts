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

// These characters are not decomposed into a base Latin character by Unicode NFD
// and are not present in public/fonts/super-water.ttf.
const UNSUPPORTED_CHARACTER_REPLACEMENTS: Record<string, string> = {
  "\u1e9e": "SS",
  "\u0130": "I",
};

const UNSUPPORTED_CHARACTER_PATTERN = /[\u1e9e\u0130]/g;
const COMBINING_MARK_PATTERN = /[\u0300-\u036f]/g;

// This is the cmap coverage of public/fonts/super-water.ttf. Characters in
// these ranges are kept intact; unsupported Latin characters are normalized
// to their closest ASCII base character below.
const SUPER_WATER_SUPPORTED_CODEPOINT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00a0, 0x00ff],
  [0x0110, 0x0111],
  [0x0131, 0x0131],
  [0x0141, 0x0142],
  [0x0152, 0x0153],
  [0x0160, 0x0161],
  [0x0178, 0x0178],
  [0x017d, 0x017e],
  [0x0192, 0x0192],
  [0x02c6, 0x02c7],
  [0x02d8, 0x02dd],
  [0x2013, 0x2014],
  [0x2018, 0x201e],
  [0x2020, 0x2022],
  [0x2026, 0x2026],
  [0x2030, 0x2030],
  [0x2039, 0x203a],
  [0x2044, 0x2044],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0x2219, 0x2219],
  [0xfb01, 0xfb02],
];

function hasSuperWaterGlyph(character: string) {
  const codePoint = character.codePointAt(0);

  if (codePoint === undefined || codePoint <= 0x007f) {
    return true;
  }

  return SUPER_WATER_SUPPORTED_CODEPOINT_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

// Super Water is enabled for Latin UI locales. Characters supported by the
// actual font are preserved; unsupported accented characters fall back to an
// ASCII base character so they do not render with a broken fallback glyph.
export function canUseSuperWater(locale: LocaleCode) {
  return SUPER_WATER_LOCALES.has(locale);
}

export function formatSuperWaterText(locale: LocaleCode, text: string) {
  if (!canUseSuperWater(locale)) {
    return text;
  }

  const replaced = text.replace(
    UNSUPPORTED_CHARACTER_PATTERN,
    (character) => UNSUPPORTED_CHARACTER_REPLACEMENTS[character] ?? character,
  );

  return Array.from(replaced, (character) => {
    if (hasSuperWaterGlyph(character)) {
      return character;
    }

    return character.normalize("NFD").replace(COMBINING_MARK_PATTERN, "");
  }).join("");
}

/**
 * Formats a localized label that is rendered in uppercase with Super Water.
 * Uppercasing must happen before ASCII conversion so Turkish casing does not
 * turn a supported ASCII `I` into an unsupported dotted `İ`.
 */
export function formatSuperWaterUppercaseText(locale: LocaleCode, text: string) {
  return formatSuperWaterText(locale, text.toLocaleUpperCase(locale));
}
