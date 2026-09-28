import { LOCALE_CODES } from "@/data/languages";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { VocabularyCard } from "@/types/domain";

export function buildPreviewVocabularyCard(generated: GeneratedCardResponse): VocabularyCard {
  const { language, tier, termKind } = generated;
  const id = `preview:${language}:${tier}:${encodeURIComponent(generated.term)}`;

  const translations: Record<string, string> = {};
  for (const locale of LOCALE_CODES) {
    translations[locale] = generated.translations[locale] ?? generated.translations["en"] ?? generated.term;
  }

  const examples = generated.examples.map((example, index) => {
    const exampleTranslations: Record<string, string> = {};
    for (const locale of LOCALE_CODES) {
      exampleTranslations[locale] = locale === "en" ? example.translation : "";
    }

    return {
      id: `${id}:example:${index}`,
      context: index === 0 ? "daily" as const : "natural" as const,
      label: index === 0 ? "Daily" : "Natural",
      sentence: example.sentence,
      translation: example.translation,
      translations: exampleTranslations,
    };
  });

  const grammar = {
    summary: "",
    rules: generated.grammar,
    details: [],
  };

  const translationMeaningsByLocale: Record<string, string[]> = {};
  for (const locale of LOCALE_CODES) {
    translationMeaningsByLocale[locale] = [translations[locale]];
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
    definitionsByLocale: generated.definitions,
    grammar,
    grammarByLocale,
  };
}
