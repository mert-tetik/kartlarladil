import type { CardExample, GrammarGuide, LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";

export function getStudyLocale(cardLanguage: LanguageCode, uiLocale: LocaleCode): LocaleCode {
  if (cardLanguage !== uiLocale) {
    return uiLocale;
  }

  return uiLocale === "en" ? "tr" : "en";
}

export function getCardTranslation(card: VocabularyCard, uiLocale: LocaleCode): string {
  return getCardTranslationMeanings(card, uiLocale).slice(0, 3).join(", ");
}

export function getPrimaryCardTranslation(card: VocabularyCard, uiLocale: LocaleCode): string {
  return getCardTranslationMeanings(card, uiLocale)[0] ?? card.translation;
}

export function getCardTranslationMeanings(card: VocabularyCard, uiLocale: LocaleCode): string[] {
  const studyLocale = getStudyLocale(card.language, uiLocale);
  const meanings = card.translationMeaningsByLocale[studyLocale] ?? [];

  if (meanings.length > 0) {
    return meanings;
  }

  const primaryTranslation = card.translations[studyLocale] || card.translation;
  return primaryTranslation ? [primaryTranslation] : [];
}

export function getCardExampleTranslation(example: CardExample, uiLocale: LocaleCode): string {
  return example.translations[uiLocale]?.trim() || example.translation.trim();
}

export function getCardGrammar(card: VocabularyCard, uiLocale: LocaleCode): GrammarGuide {
  return card.grammarByLocale[uiLocale] || card.grammar;
}

export function getSearchableCardText(card: VocabularyCard, uiLocale?: LocaleCode): string {
  const translations = uiLocale
    ? getCardTranslationMeanings(card, uiLocale)
    : Object.values(card.translationMeaningsByLocale).flat();
  const examples = card.examples.map((example) => example.sentence);
  return [card.term, card.pronunciation, card.partOfSpeech, ...examples, ...translations].join(" ");
}
