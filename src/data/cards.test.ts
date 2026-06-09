import { describe, expect, it } from "vitest";
import {
  CATALOG_REPORT,
  VOCABULARY_CARDS,
  createCardSourceKey,
  isSingleWordTerm,
} from "@/data/cards";
import { LANGUAGES } from "@/data/languages";
import { TIERS } from "@/data/tiers";

describe("starter card catalog", () => {
  it("contains a meaningful single-word starter catalog for the first three languages", () => {
    expect(VOCABULARY_CARDS.length).toBeGreaterThan(0);
    expect(CATALOG_REPORT.total).toBe(VOCABULARY_CARDS.length);

    for (const language of LANGUAGES) {
      expect(CATALOG_REPORT.byLanguage[language.code]).toBeGreaterThan(0);

      for (const tier of TIERS) {
        expect(CATALOG_REPORT.byLanguageTier[language.code][tier]).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every card term as a strict single word", () => {
    expect(isSingleWordTerm("apple")).toBe(true);
    expect(isSingleWordTerm("учиться")).toBe(true);
    expect(isSingleWordTerm("where is")).toBe(false);
    expect(isSingleWordTerm("E-Mail")).toBe(false);
    expect(isSingleWordTerm("word:context")).toBe(false);

    expect(CATALOG_REPORT.invalidTerms).toEqual([]);
  });

  it("keeps ids and source keys stable, deterministic, and unique", () => {
    const ids = new Set(VOCABULARY_CARDS.map((card) => card.id));
    const sourceKeys = new Set(VOCABULARY_CARDS.map((card) => card.sourceKey));

    expect(ids.size).toBe(VOCABULARY_CARDS.length);
    expect(sourceKeys.size).toBe(VOCABULARY_CARDS.length);
    expect(VOCABULARY_CARDS.every((card) => card.sourceKey === card.id)).toBe(true);

    for (const card of VOCABULARY_CARDS) {
      expect(card.sourceKey).toBe(createCardSourceKey(card.language, card.tier, card.term, card.partOfSpeech));
    }
  });

  it("does not duplicate a term within the same language", () => {
    expect(CATALOG_REPORT.duplicateTerms).toEqual([]);
  });

  it("adds five varied examples to every card", () => {
    const expectedContexts = ["daily", "question", "negative", "contextual", "natural"];
    const placeholderPattern = /is useful in a clear sentence|I wrote the word|clear sentence|klaren Satz|açık bir cümlede/i;
    const invalidCards = VOCABULARY_CARDS.filter(
      (card) =>
        card.examples.length !== 5 ||
        card.examples.map((example) => example.context).join("|") !== expectedContexts.join("|") ||
        card.examples[0].sentence !== card.example ||
        card.examples[0].translation !== card.exampleTranslation ||
        card.examples.some((example) => !example.sentence.trim() || !example.translation.trim()) ||
        placeholderPattern.test(card.example) ||
        placeholderPattern.test(card.examples[0].sentence),
    );

    expect(invalidCards).toEqual([]);
  });

  it("keeps the first example sentences distributed across multiple patterns", () => {
    for (const language of LANGUAGES) {
      const patternCounts = new Map<string, number>();
      const cards = VOCABULARY_CARDS.filter((card) => card.language === language.code);

      for (const card of cards) {
        const pattern = normalizeExamplePattern(card.example, card.term);
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
      }

      expect(patternCounts.size).toBeGreaterThanOrEqual(10);
      expect(Math.max(...patternCounts.values())).toBeLessThan(cards.length / 3);
    }
  });

  it("adds grammar guidance to every card", () => {
    const invalidCards = VOCABULARY_CARDS.filter(
      (card) =>
        !card.grammar.summary.trim() ||
        card.grammar.rules.length === 0 ||
        card.grammar.details.length === 0,
    );

    expect(invalidCards).toEqual([]);
  });

  it("includes conjugation tables for Russian verbs", () => {
    const russianVerb = VOCABULARY_CARDS.find(
      (card) => card.language === "ru" && card.partOfSpeech.includes("fiil"),
    );

    expect(russianVerb).toBeDefined();
    expect(russianVerb!.grammar.tables?.map((table) => table.title)).toEqual([
      "Şimdiki/geniş zaman",
      "Geçmiş zaman",
    ]);
    expect(russianVerb!.grammar.tables?.[0].rows).toHaveLength(6);
    expect(russianVerb!.grammar.tables?.[1].rows).toHaveLength(4);
  });
});

function normalizeExamplePattern(sentence: string, term: string) {
  return sentence.split(term).join("{term}");
}
