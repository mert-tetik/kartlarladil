import { LOCALE_CODES } from "@/data/languages";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { LanguageCode, Tier, TermKind, VocabularyCard } from "@/types/domain";

export function buildPreviewVocabularyCard(
  language: LanguageCode,
  tier: Tier,
  termKind: TermKind,
  generated: GeneratedCardResponse,
): VocabularyCard {
  const id = `preview:${language}:${tier}:${encodeURIComponent(generated.term)}`;

  const translations: Record<string, string> = {};
  for (const locale of LOCALE_CODES) {
    translations[locale] = generated.translations[locale] ?? generated.translations["en"] ?? generated.term;
  }

  const exampleTranslations: Record<string, string> = {};
  for (const locale of LOCALE_CODES) {
    exampleTranslations[locale] = locale === "en" ? generated.exampleTranslation : "";
  }

  const examples = [
    {
      id: `${id}:example:0`,
      context: "natural" as const,
      label: "Natural",
      sentence: generated.example,
      translation: generated.exampleTranslation,
      translations: exampleTranslations,
    },
  ];

  const grammar = {
    summary: "",
    rules: generated.grammar,
    details: [],
  };

  const translationMeaningsByLocale: Record<string, string[]> = {};
  for (const locale of LOCALE_CODES) {
    translationMeaningsByLocale[locale] = [];
  }

  const grammarByLocale: Record<string, typeof grammar> = {};
  for (const locale of LOCALE_CODES) {
    grammarByLocale[locale] = grammar;
  }

  return {
    id,
    sourceKey: id,
    englishKey: generated.translations["en"] ?? generated.term,
    language,
    tier,
    termKind,
    term: generated.term,
    translation: generated.translations["en"] ?? generated.term,
    translations,
    translationMeaningsByLocale,
    pronunciation: generated.pronunciation,
    partOfSpeech: generated.partOfSpeech,
    example: generated.example,
    exampleTranslation: generated.exampleTranslation,
    examples,
    grammar,
    grammarByLocale,
  };
}
