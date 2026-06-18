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
  it("contains a non-empty catalog for every supported language and tier", () => {
    expect(CATALOG_REPORT.total).toBe(VOCABULARY_CARDS.length);
    expect(LANGUAGES).toHaveLength(14);
    expect(LOCALE_CODES).toHaveLength(14);

    for (const language of LANGUAGES) {
      expect(CATALOG_REPORT.strictWordCountByLanguage[language.code]).toBeGreaterThan(0);

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
    expect(isFixedPhraseTerm("where is the station now")).toBe(false);

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
        createCardSourceKey(card.language, card.tier, card.englishKey, card.partOfSpeech, card.termKind),
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

  it("uses a single example for every card", () => {
    const placeholderPattern = /is useful in a clear sentence|I wrote the word|clear sentence/i;
    const invalidCards = VOCABULARY_CARDS.filter(
      (card) =>
        card.examples.length !== 1 ||
        card.examples[0].context !== "daily" ||
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
