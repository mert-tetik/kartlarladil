import type { LanguageCode, LocaleCode, TermKind, Tier } from "@/types/domain";

export const CARD_SEED_LOCALE_ORDER = [
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
] as const satisfies readonly LocaleCode[];

export type CardSeedRow = readonly [
  term: string,
  tier: Tier,
  termKind: TermKind,
  partOfSpeech: string,
  pronunciation: string,
  tr: string,
  en: string,
  de: string,
  ru: string,
  fr: string,
  es: string,
  it: string,
  pt: string,
  nl: string,
  pl: string,
  ar: string,
  ja: string,
  ko: string,
  zhCN: string,
];

export interface CardSeedModule {
  language: LanguageCode;
  rows: readonly CardSeedRow[];
}

export function rowToTranslations(row: CardSeedRow): Record<LocaleCode, string> {
  const values = row.slice(5);

  return Object.fromEntries(
    CARD_SEED_LOCALE_ORDER.map((locale, index) => [locale, values[index] || row[0]]),
  ) as Record<LocaleCode, string>;
}
