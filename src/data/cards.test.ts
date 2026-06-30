import {
  CATALOG_REPORT,
  VOCABULARY_CARDS,
  createCardSourceKey,
  isLikelyLocalizedExampleSentence,
  isFixedPhraseTerm,
  isSingleWordTerm,
} from "@/data/cards";
import { CARD_PRONUNCIATIONS } from "@/data/card-pronunciations.generated";
import { masterCardEntries } from "@/data/card-seeds/master-list";
import { CARD_SEED_LOCALE_ORDER } from "@/data/card-seeds/types";
import { LANGUAGES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import {
  createCardRequestSchema,
  generatedCardSchema,
} from "@/features/cards/create-card-schema";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { mapDbCustomCardToVocabularyCard } from "@/features/cards/custom-card-mapper";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import type { DbCustomCard } from "@/features/cards/custom-card-types";
import type { VocabularyCard } from "@/types/domain";

const LATIN_SCRIPT_LOCALES = ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "pl"] as const;
const NON_LATIN_SCRIPT_PATTERN = /[\u0400-\u04FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u;
const IPA_PATTERN = /^\/.+\/$/u;

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

  it("stores translation meanings for every supported locale", () => {
    const invalidCards = VOCABULARY_CARDS.filter((card) =>
      LOCALE_CODES.some((locale) => {
        const meanings = card.translationMeaningsByLocale[locale];
        return (
          !Array.isArray(meanings) ||
          meanings.length === 0 ||
          meanings.length > 3 ||
          meanings.some((meaning) => !meaning.trim())
        );
      }),
    );

    expect(invalidCards).toEqual([]);
  });

  it("stores valid IPA pronunciations for generated pronunciation overrides", () => {
    expect(Object.keys(CARD_PRONUNCIATIONS).length).toBeGreaterThan(0);

    const invalidGeneratedEntries = Object.entries(CARD_PRONUNCIATIONS).filter(([, pronunciation]) => {
      return !IPA_PATTERN.test(pronunciation.trim());
    });

    expect(invalidGeneratedEntries).toEqual([]);

    const trAbandon = VOCABULARY_CARDS.find((card) => card.sourceKey === "tr:B2:word:abandon:verb");
    const deAbility = VOCABULARY_CARDS.find((card) => card.sourceKey === "de:A2:word:ability:noun");
    const ruAbout = VOCABULARY_CARDS.find((card) => card.sourceKey === "ru:A1:word:about:adverb");

    expect(trAbandon?.pronunciation).toMatch(IPA_PATTERN);
    expect(deAbility?.pronunciation).toMatch(IPA_PATTERN);
    expect(ruAbout?.pronunciation).toMatch(IPA_PATTERN);
  });

  it("uses two unique examples for every card", () => {
    const placeholderPattern = /is useful in a clear sentence|I wrote the word|clear sentence/i;
    const invalidCards = VOCABULARY_CARDS.filter((card) => {
      if (card.examples.length !== 2) {
        return true;
      }

      if (card.examples[0].context !== "daily" || card.examples[1].context !== "natural") {
        return true;
      }

      if (card.examples[0].sentence !== card.example || card.examples[0].translation !== card.exampleTranslation) {
        return true;
      }

      const normalizedSentences = card.examples.map((example) => example.sentence.trim().normalize("NFC"));
      if (new Set(normalizedSentences).size !== 2) {
        return true;
      }

      return card.examples.some((example) => !example.sentence.trim() || placeholderPattern.test(example.sentence));
    });

    expect(invalidCards).toEqual([]);
  });

  it("keeps example sentences localized to the card language", () => {
    const invalidCards = VOCABULARY_CARDS.flatMap((card) =>
      card.examples
        .filter((example) => !isLikelyLocalizedExampleSentence(card.language, example.sentence))
        .map((example) => ({
          sourceKey: card.sourceKey,
          language: card.language,
          example: example.sentence,
        })),
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

  it("keeps latin-script translation columns free of non-latin text", () => {
    const invalidEntries = masterCardEntries.flatMap((row) =>
      LATIN_SCRIPT_LOCALES.flatMap((locale) => {
        const columnIndex = CARD_SEED_LOCALE_ORDER.indexOf(locale) + 5;
        const value = String(row[columnIndex] ?? "").trim();

        if (!value || !NON_LATIN_SCRIPT_PATTERN.test(value)) {
          return [];
        }

        return [
          {
            englishKey: row[0],
            locale,
            value,
          },
        ];
      }),
    );

    expect(invalidEntries).toEqual([]);
  });
});

describe("custom card mapper", () => {
  it("maps a complete custom card row to a vocabulary card", () => {
    const db: DbCustomCard = {
      id: "00000000-0000-0000-0000-000000000000",
      user_id: "user-1",
      source_key: "custom:user:1",
      language: "en",
      tier: "A1",
      term: "custom",
      term_kind: "word",
      translations: { en: "custom", tr: "özel" },
      translation_meanings: {},
      part_of_speech: "noun",
      pronunciation: "/ˈkʌstəm/",
      examples: [{ example: "This is a custom card.", translation: "Bu özel bir kart." }],
      grammar: { notes: ["Often used as an adjective."] },
      created_at: "2026-01-01T00:00:00Z",
    };
    const card = mapDbCustomCardToVocabularyCard(db);

    expect(card.id).toBe(db.source_key);
    expect(card.term).toBe("custom");
    expect(card.example).toBe("This is a custom card.");
    expect(card.grammar.rules).toContain("Often used as an adjective.");
  });

  it("defaults term kind to word when unknown", () => {
    const db: DbCustomCard = {
      id: "00000000-0000-0000-0000-000000000000",
      user_id: "user-1",
      source_key: "custom:user:2",
      language: "en",
      tier: "A1",
      term: "custom",
      term_kind: "unknown",
      translations: { en: "custom" },
      translation_meanings: {},
      part_of_speech: "noun",
      pronunciation: "",
      examples: [],
      grammar: { notes: [] },
      created_at: "2026-01-01T00:00:00Z",
    };

    expect(mapDbCustomCardToVocabularyCard(db).termKind).toBe("word");
  });
});

describe("custom card preview", () => {
  it("builds a preview card from generated response", () => {
    const card = buildPreviewVocabularyCard({
      language: "en",
      tier: "A2",
      termKind: "word",
      term: "journey",
      partOfSpeech: "noun",
      pronunciation: "/ˈdʒɜːni/",
      translations: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, locale === "en" ? "journey" : "x"])),
      example: "The journey was long.",
      exampleTranslation: "Yolculuk uzundu.",
      grammar: ["Countable noun"],
    });

    expect(card.term).toBe("journey");
    expect(card.tier).toBe("A2");
    expect(card.termKind).toBe("word");
  });
});

describe("create card schema", () => {
  it("accepts a valid request", () => {
    const result = createCardRequestSchema.safeParse({
      locale: "en",
      term: "journey",
    });

    expect(result.success).toBe(true);
  });

  it("rejects generated cards missing a translation locale", () => {
    const result = generatedCardSchema.safeParse({
      language: "en",
      tier: "A1",
      termKind: "word",
      term: "journey",
      partOfSpeech: "noun",
      pronunciation: "",
      translations: { en: "journey" },
      example: "The journey was long.",
      exampleTranslation: "Yolculuk uzundu.",
      grammar: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("custom card registry", () => {
  beforeEach(() => {
    customCardRegistry.clear();
  });

  it("overrides bundled cards with the same source key", () => {
    const bundled = VOCABULARY_CARDS[0];
    const custom: VocabularyCard = {
      ...bundled,
      sourceKey: bundled.sourceKey,
      id: bundled.sourceKey,
      term: "custom",
    };
    customCardRegistry.register(custom);

    expect(customCardRegistry.findBySourceKey(bundled.sourceKey)).toBe(custom);
    expect(customCardRegistry.list()).toHaveLength(1);

    const all = customCardRegistry.getAllCards();
    const found = all.find((card) => card.sourceKey === bundled.sourceKey);
    expect(found?.term).toBe("custom");
    expect(all.filter((card) => card.sourceKey === bundled.sourceKey)).toHaveLength(1);
  });
});
