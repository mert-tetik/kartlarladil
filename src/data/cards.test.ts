import {
  CATALOG_REPORT,
  VOCABULARY_CARDS,
  createCardSourceKey,
  isFixedPhraseTerm,
  isSingleWordTerm,
} from "@/data/cards";
import { LANGUAGES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";

describe("multilingual card catalog", () => {
  it("contains at least 2000 strict single-word cards for every supported language", () => {
    expect(VOCABULARY_CARDS).toHaveLength(28_000);
    expect(CATALOG_REPORT.total).toBe(VOCABULARY_CARDS.length);
    expect(LANGUAGES).toHaveLength(14);
    expect(LOCALE_CODES).toHaveLength(14);

    for (const language of LANGUAGES) {
      expect(CATALOG_REPORT.strictWordCountByLanguage[language.code]).toBeGreaterThanOrEqual(2000);

      for (const tier of TIERS) {
        expect(CATALOG_REPORT.byLanguageTier[language.code][tier]).toBeGreaterThan(0);
      }
    }
  });

  it("validates word and fixed phrase token rules", () => {
    expect(isSingleWordTerm("apple")).toBe(true);
    expect(isSingleWordTerm("учиться")).toBe(true);
    expect(isSingleWordTerm("where is")).toBe(false);
    expect(isSingleWordTerm("E-Mail")).toBe(false);
    expect(isSingleWordTerm("word:context")).toBe(false);
    expect(isFixedPhraseTerm("Guten Morgen")).toBe(true);
    expect(isFixedPhraseTerm("where is the station")).toBe(false);

    expect(CATALOG_REPORT.invalidTerms).toEqual([]);
  });

  it("keeps ids and source keys stable, deterministic, and unique", () => {
    const ids = new Set(VOCABULARY_CARDS.map((card) => card.id));
    const sourceKeys = new Set(VOCABULARY_CARDS.map((card) => card.sourceKey));

    expect(ids.size).toBe(VOCABULARY_CARDS.length);
    expect(sourceKeys.size).toBe(VOCABULARY_CARDS.length);
    expect(VOCABULARY_CARDS.every((card) => card.sourceKey === card.id)).toBe(true);

    for (const card of VOCABULARY_CARDS) {
      expect(card.sourceKey).toBe(
        createCardSourceKey(card.language, card.tier, card.term, card.partOfSpeech, card.termKind),
      );
    }
  });

  it("does not duplicate a term within the same language", () => {
    expect(CATALOG_REPORT.duplicateTerms).toEqual([]);
  });

  it("stores translations for every supported locale", () => {
    expect(CATALOG_REPORT.missingTranslations).toEqual([]);

    for (const card of VOCABULARY_CARDS.slice(0, 500)) {
      for (const locale of LOCALE_CODES) {
        expect(card.translations[locale]?.trim()).not.toBe("");
      }
    }
  });

  it("adds five varied examples to every card", () => {
    const expectedContexts = ["daily", "question", "negative", "contextual", "natural"];
    const placeholderPattern = /is useful in a clear sentence|I wrote the word|clear sentence/i;
    const invalidCards = VOCABULARY_CARDS.filter(
      (card) =>
        card.examples.length !== 5 ||
        card.examples.map((example) => example.context).join("|") !== expectedContexts.join("|") ||
        card.examples[0].sentence !== card.example ||
        card.examples[0].translation !== card.exampleTranslation ||
        card.examples.some((example) => {
          if (!example.sentence.trim() || !example.translation.trim()) {
            return true;
          }

          return LOCALE_CODES.some((locale) => !example.translations[locale]?.trim());
        }) ||
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

      expect(patternCounts.size).toBeGreaterThanOrEqual(5);
      expect(Math.max(...patternCounts.values())).toBeLessThan(cards.length / 2);
    }
  });

  it("adds grammar guidance for every locale on every card", () => {
    const invalidCards = VOCABULARY_CARDS.filter((card) =>
      LOCALE_CODES.some((locale) => {
        const grammar = card.grammarByLocale[locale];

        return !grammar.summary.trim() || grammar.rules.length === 0 || grammar.details.length === 0;
      }),
    );

    expect(invalidCards).toEqual([]);
  });
});

function normalizeExamplePattern(sentence: string, term: string) {
  return sentence.split(term).join("{term}");
}
