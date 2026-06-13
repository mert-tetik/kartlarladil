import type { CardExample, GrammarGuide, LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";

export function getStudyLocale(cardLanguage: LanguageCode, uiLocale: LocaleCode): LocaleCode {
  if (cardLanguage !== uiLocale) {
    return uiLocale;
  }

  return uiLocale === "en" ? "tr" : "en";
}

export function getCardTranslation(card: VocabularyCard, uiLocale: LocaleCode): string {
  const studyLocale = getStudyLocale(card.language, uiLocale);
  return card.translations[studyLocale] || card.translation;
}

export function getCardExampleTranslation(example: CardExample, uiLocale: LocaleCode): string {
  return example.translations[uiLocale] || example.translation;
}

export function getCardGrammar(card: VocabularyCard, uiLocale: LocaleCode): GrammarGuide {
  return card.grammarByLocale[uiLocale] || card.grammar;
}

export function getSearchableCardText(card: VocabularyCard, uiLocale?: LocaleCode): string {
  const translations = uiLocale ? [getCardTranslation(card, uiLocale)] : Object.values(card.translations);
  return [card.term, card.pronunciation, card.partOfSpeech, card.example, ...translations].join(" ");
}
