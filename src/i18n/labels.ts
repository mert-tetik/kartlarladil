import { LANGUAGE_BY_CODE } from "@/data/languages";
import { translate, type TranslationKey } from "@/i18n/dictionaries";
import type {
  ExampleContext,
  LanguageCode,
  LocaleCode,
  RankDefinition,
  TermKind,
  Tier,
} from "@/types/domain";

const LANGUAGE_KEY_BY_CODE: Record<LanguageCode, TranslationKey> = {
  tr: "language.tr",
  en: "language.en",
  de: "language.de",
  ru: "language.ru",
  fr: "language.fr",
  es: "language.es",
  it: "language.it",
  pt: "language.pt",
  nl: "language.nl",
  pl: "language.pl",
  ar: "language.ar",
  ja: "language.ja",
  ko: "language.ko",
  "zh-CN": "language.zh-CN",
};

const TIER_KEY_BY_CODE: Record<Tier, TranslationKey> = {
  A1: "tier.A1",
  A2: "tier.A2",
  B1: "tier.B1",
  B2: "tier.B2",
  C1: "tier.C1",
};

const EXAMPLE_KEY_BY_CONTEXT: Record<ExampleContext, TranslationKey> = {
  daily: "example.daily",
  question: "example.question",
  negative: "example.negative",
  contextual: "example.contextual",
  natural: "example.natural",
};

const PART_OF_SPEECH_KEY_BY_KIND: Record<TermKind, TranslationKey> = {
  word: "partOfSpeech.word",
  fixed_phrase: "partOfSpeech.fixed_phrase",
};

export function getLanguageDisplayName(code: LanguageCode, locale: LocaleCode) {
  return translate(locale, LANGUAGE_KEY_BY_CODE[code]);
}

export function getLanguageNativeName(code: LanguageCode) {
  return LANGUAGE_BY_CODE[code].nativeName;
}

export function getTierLabel(tier: Tier, locale: LocaleCode) {
  return translate(locale, TIER_KEY_BY_CODE[tier]);
}

export function getRankLabel(rank: RankDefinition, locale: LocaleCode) {
  return translate(locale, `rank.${rank.id}` as TranslationKey);
}

export function getExampleContextLabel(context: ExampleContext, locale: LocaleCode) {
  return translate(locale, EXAMPLE_KEY_BY_CONTEXT[context]);
}

export function getPartOfSpeechLabel(termKind: TermKind, locale: LocaleCode) {
  return translate(locale, PART_OF_SPEECH_KEY_BY_KIND[termKind]);
}

export function formatNumber(locale: LocaleCode, value: number) {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(value);
}

export function formatPoints(locale: LocaleCode, value: number) {
  return translate(locale, "common.pointsWithCount", { count: formatNumber(locale, value) });
}

export function formatCards(locale: LocaleCode, value: number) {
  return translate(locale, "common.cardsWithCount", { count: formatNumber(locale, value) });
}

export function toIntlLocale(locale: LocaleCode) {
  return locale === "zh-CN" ? "zh-CN" : locale;
}
