import type { LanguageCode } from "@/types/domain";

/**
 * Localized "Word of the Day" titles for social posters and thumbnails.
 * These are short, fixed phrases that should not require a round-trip to the
 * creative model every time a card image is rendered.
 */
export const WORD_OF_THE_DAY_TITLE: Record<LanguageCode, string> = {
  tr: "Günün Kelimesi",
  en: "Word of the Day",
  de: "Wort des Tages",
  ru: "Слово дня",
  fr: "Mot du Jour",
  es: "Palabra del Día",
  it: "Parola del Giorno",
  pt: "Palavra do Dia",
  nl: "Woord van de Dag",
  pl: "Słowo Dnia",
  ar: "كلمة اليوم",
  ja: "今日の単語",
  ko: "오늘의 단어",
  "zh-CN": "今日单词",
};

export function getWordOfTheDayTitle(language: LanguageCode) {
  return WORD_OF_THE_DAY_TITLE[language];
}
