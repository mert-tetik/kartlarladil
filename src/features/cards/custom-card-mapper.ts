import { LOCALE_CODES } from "@/data/languages";
import type { VocabularyCard, CardExample, GrammarGuide, LanguageCode, Tier, TermKind } from "@/types/domain";
import type { DbCustomCard } from "./custom-card-types";

function toCardExample(value: unknown, sourceKey: string, index: number): CardExample | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sentence = typeof record.example === "string" ? record.example : "";
  const translation = typeof record.translation === "string" ? record.translation : "";

  if (!sentence) {
    return null;
  }

  const translations: Record<string, string> = {};
  for (const locale of LOCALE_CODES) {
    translations[locale] = locale === "en" ? translation : "";
  }

  return {
    id: `${sourceKey}:example:${index}`,
    context: "natural",
    label: "Natural",
    sentence,
    translation,
    translations,
  };
}

function toGrammarGuide(value: unknown): GrammarGuide {
  const notes: string[] = [];

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.notes)) {
      for (const note of record.notes) {
        if (typeof note === "string") {
          notes.push(note);
        }
      }
    }
  }

  return {
    summary: "",
    rules: notes,
    details: [],
  };
}

export function mapDbCustomCardToVocabularyCard(db: DbCustomCard): VocabularyCard {
  const id = db.source_key;

  const examples: CardExample[] = [];
  if (Array.isArray(db.examples)) {
    for (let index = 0; index < db.examples.length; index++) {
      const parsed = toCardExample(db.examples[index], db.source_key, index);
      if (parsed) {
        examples.push(parsed);
      }
    }
  }

  const rawTranslations = (db.translations as Record<string, string>) ?? {};
  const translations: Record<string, string> = {};
  for (const locale of LOCALE_CODES) {
    const value = rawTranslations[locale];
    translations[locale] = typeof value === "string" ? value : rawTranslations["en"] ?? db.term;
  }

  const rawMeanings = (db.translation_meanings as Record<string, string[] | undefined>) ?? {};
  const translationMeaningsByLocale: Record<string, string[]> = {};
  for (const locale of LOCALE_CODES) {
    const meanings = rawMeanings[locale];
    translationMeaningsByLocale[locale] =
      Array.isArray(meanings) && meanings.length > 0 ? meanings : [translations[locale]];
  }

  const grammar = toGrammarGuide(db.grammar);
  const grammarByLocale: Record<string, GrammarGuide> = {};
  for (const locale of LOCALE_CODES) {
    grammarByLocale[locale] = grammar;
  }

  const termKind: TermKind = db.term_kind === "fixed_phrase" ? "fixed_phrase" : "word";

  const firstExample = examples[0];
  const example = firstExample?.sentence ?? "";
  const exampleTranslation = firstExample?.translation ?? "";

  return {
    id,
    sourceKey: db.source_key,
    englishKey: rawTranslations["en"] ?? db.term,
    language: db.language as LanguageCode,
    tier: db.tier as Tier,
    termKind,
    term: db.term,
    translation: rawTranslations["en"] ?? db.term,
    translations,
    translationMeaningsByLocale,
    pronunciation: db.pronunciation ?? "",
    partOfSpeech: db.part_of_speech ?? "",
    example,
    exampleTranslation,
    examples,
    grammar,
    grammarByLocale,
  };
}
