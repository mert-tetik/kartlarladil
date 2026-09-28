import {
  CATALOG_REPORT,
  VOCABULARY_CARDS,
  createCardSourceKey,
  isLikelyLocalizedExampleSentence,
  isFixedPhraseTerm,
  isSingleWordTerm,
} from "@/data/cards";
import { CARD_DEFINITIONS } from "@/data/card-definitions.generated";
import { CARD_EXAMPLE_SENTENCES } from "@/data/card-examples.generated";
import { CARD_PRONUNCIATIONS } from "@/data/card-pronunciations.generated";
import { getCardDefinition, getCardDefinitionKey } from "@/data/card-definitions";
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
const TURKISH_READER_PRONUNCIATION_PATTERN = /^[a-z\u0131]+(?:[ '-][a-z\u0131]+)*$/u;
const TURKISH_ORTHOGRAPHIC_PRONUNCIATION_PATTERN = /^[a-z\u0131\u00e7\u011f\u00f6\u015f\u00fc]+(?:[ '-][a-z\u0131\u00e7\u011f\u00f6\u015f\u00fc]+)*$/u;
const NON_LATIN_DEFINITION_SCRIPT_BY_LOCALE = {
  ru: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ko: /\p{Script=Hangul}/u,
  "zh-CN": /\p{Script=Han}/u,
} as const;

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

  it("provides a definition in every supported locale for every catalog card", () => {
    const missingDefinitions = VOCABULARY_CARDS.flatMap((card) =>
      LOCALE_CODES.filter((locale) => !getCardDefinition(card, locale)).map((locale) => ({
        sourceKey: card.sourceKey,
        locale,
      })),
    );

    expect(
      missingDefinitions,
      `Missing ${missingDefinitions.length} card definitions; first entries: ${JSON.stringify(missingDefinitions.slice(0, 30))}`,
    ).toHaveLength(0);
  });

  it("stores each concept definition directly in every supported locale", () => {
    const definitionKeys = new Set(VOCABULARY_CARDS.map(getCardDefinitionKey));
    const missingDefinitions = [...definitionKeys].flatMap((definitionKey) =>
      LOCALE_CODES.filter((locale) => !CARD_DEFINITIONS[definitionKey]?.[locale]?.trim()).map((locale) => ({
        definitionKey,
        locale,
      })),
    );
    const wrongScriptDefinitions = [...definitionKeys].flatMap((definitionKey) =>
      Object.entries(NON_LATIN_DEFINITION_SCRIPT_BY_LOCALE).flatMap(([locale, script]) => {
        const definition = CARD_DEFINITIONS[definitionKey]?.[locale]?.trim() ?? "";
        return script.test(definition) ? [] : [{ definitionKey, locale }];
      }),
    );

    expect(missingDefinitions).toEqual([]);
    expect(wrongScriptDefinitions).toEqual([]);
  });

  it("keeps audited definitions accurate and distinguishes near-synonyms", () => {
    expect(CARD_DEFINITIONS["en:A1:word:afternoon:noun"]).toMatchObject({
      en: "the part of the day between noon and evening",
      ru: "время суток между полуднем и вечером",
      it: "La parte della giornata tra mezzogiorno e la sera.",
    });
    expect(CARD_DEFINITIONS["en:A1:word:evening:noun"]).toMatchObject({
      tr: "Gün batımından geceye kadar olan gün bölümü.",
      ru: "вечерняя часть суток между концом дня и наступлением ночи",
      pl: "Pora dnia między późnym popołudniem a nocą.",
    });
    expect(CARD_DEFINITIONS["en:A1:word:desk:noun"]?.it).toBe(
      "Mobile con un piano di lavoro per studiare o lavorare.",
    );
    expect(CARD_DEFINITIONS["en:A1:word:table:noun"]?.it).toBe(
      "Mobile con un piano d’appoggio, usato per mangiare o appoggiare oggetti.",
    );
    expect(CARD_DEFINITIONS["en:A1:word:across:adverb"]?.en).not.toBe(
      CARD_DEFINITIONS["en:A1:word:through:adverb"]?.en,
    );
  });

  it("provides a non-empty pronunciation for every catalog card", () => {
    const missingPronunciations = VOCABULARY_CARDS
      .filter((card) => !card.pronunciation.trim())
      .map((card) => card.sourceKey);
    const invalidPronunciations = VOCABULARY_CARDS
      .filter((card) => {
        const pattern = card.language === "tr"
          ? TURKISH_ORTHOGRAPHIC_PRONUNCIATION_PATTERN
          : TURKISH_READER_PRONUNCIATION_PATTERN;
        return !pattern.test(card.pronunciation.trim());
      })
      .map((card) => ({ sourceKey: card.sourceKey, pronunciation: card.pronunciation }));

    expect(
      missingPronunciations,
      `Missing ${missingPronunciations.length} card pronunciations; first entries: ${JSON.stringify(missingPronunciations.slice(0, 30))}`,
    ).toHaveLength(0);
    expect(
      invalidPronunciations,
      `Invalid ${invalidPronunciations.length} card pronunciations; first entries: ${JSON.stringify(invalidPronunciations.slice(0, 30))}`,
    ).toHaveLength(0);

    const missingGeneratedPronunciations = VOCABULARY_CARDS
      .filter((card) => !CARD_PRONUNCIATIONS[card.sourceKey]?.trim())
      .map((card) => card.sourceKey);
    expect(missingGeneratedPronunciations).toEqual([]);

  });

  it("stores valid Turkish-reader pronunciations for generated pronunciation overrides", () => {
    expect(Object.keys(CARD_PRONUNCIATIONS).length).toBeGreaterThan(0);

    const invalidGeneratedEntries = Object.entries(CARD_PRONUNCIATIONS).filter(([sourceKey, pronunciation]) => {
      const pattern = sourceKey.startsWith("tr:")
        ? TURKISH_ORTHOGRAPHIC_PRONUNCIATION_PATTERN
        : TURKISH_READER_PRONUNCIATION_PATTERN;
      return !pattern.test(pronunciation.trim());
    });

    expect(invalidGeneratedEntries).toEqual([]);

    const trAbandon = VOCABULARY_CARDS.find((card) => card.sourceKey === "tr:B2:word:abandon:verb");
    const deAbility = VOCABULARY_CARDS.find((card) => card.sourceKey === "de:A2:word:ability:noun");
    const ruAbout = VOCABULARY_CARDS.find((card) => card.sourceKey === "ru:A1:word:about:adverb");

    expect(trAbandon?.pronunciation).toMatch(TURKISH_READER_PRONUNCIATION_PATTERN);
    expect(deAbility?.pronunciation).toMatch(TURKISH_READER_PRONUNCIATION_PATTERN);
    expect(ruAbout?.pronunciation).toMatch(TURKISH_READER_PRONUNCIATION_PATTERN);
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

      const normalizedSentences = card.examples.map((example) =>
        example.sentence
          .trim()
          .normalize("NFKC")
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ""),
      );
      if (new Set(normalizedSentences).size !== 2) {
        return true;
      }

      return card.examples.some((example) => !example.sentence.trim() || placeholderPattern.test(example.sentence));
    });

    expect(invalidCards).toEqual([]);
  });

  it("stores two unique, localized generated examples for every catalog source key", () => {
    const invalidExamples = VOCABULARY_CARDS.flatMap((card) => {
      const examples = CARD_EXAMPLE_SENTENCES[card.sourceKey];
      if (!Array.isArray(examples) || examples.length !== 2) return [card.sourceKey];

      const normalized = examples.map((sentence) =>
        sentence.trim().normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""),
      );
      const areUnique = new Set(normalized).size === 2;
      const areLocalized = examples.every((sentence) => isLikelyLocalizedExampleSentence(card.language, sentence));
      return areUnique && areLocalized ? [] : [card.sourceKey];
    });

    expect(invalidExamples).toEqual([]);
  });

  it("keeps targeted grammar and meaning corrections in reviewed example records", () => {
    expect(CARD_EXAMPLE_SENTENCES["ar:A1:word:about:adverb"]).toEqual([
      "قرأت مقالًا حول تغيّر المناخ.",
      "تحدثنا حول الخطة الجديدة في الاجتماع.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ar:B1:word:absolutely:adverb"]).toEqual([
      "أوافق على الفكرة بالكامل.",
      "أنهيتُ العمل بالكامل قبل الموعد.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["fr:B1:word:accommodation:noun"]).toEqual([
      "Nous cherchons un hébergement près du centre.",
      "Notre hébergement comprend le petit-déjeuner.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ja:B2:word:abandon:verb"]).toEqual([
      "彼は計画を途中で放棄した。",
      "彼女は責任を放棄せず、最後まで役目を果たした。",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ja:B2:word:accompany:verb"]).toEqual([
      "医師は通訳とともに患者に同行した。",
      "出張には同僚が同行します。",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ko:B2:word:abandon:verb"]).toEqual([
      "그는 오래된 계획을 버리고 새로운 계획을 세웠어요.",
      "그녀는 어려움이 있어도 꿈을 버리지 않았어요.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ru:B2:word:accompany:verb"]).toEqual([
      "Я сопровожу тебя до остановки.",
      "Он сопровождает туристов по музею каждый день.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["tr:A2:word:achieve:verb"]).toEqual([
      "Bu yıl koyduğum hedefe ulaşmayı başardım.",
      "Zorluklara rağmen projeyi zamanında tamamlamayı başardık.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["tr:B2:word:accompany:verb"]).toEqual([
      "Sana eve kadar eşlik edeceğim.",
      "Akşam sinemaya giderken arkadaşıma eşlik ettim.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["zh-CN:A2:word:able:adjective"]).toEqual([
      "我能够自己做饭，不用总是麻烦别人。",
      "即使工作很忙，他也能够按时完成任务。",
    ]);
  });

  it("keeps reviewed meanings, examples, and pronunciations aligned", () => {
    const actTerms = Object.fromEntries(
      VOCABULARY_CARDS.filter((card) => card.englishKey === "act").map((card) => [card.language, card.term]),
    );
    expect(actTerms).toEqual({
      tr: "eylem",
      en: "act",
      de: "Handlung",
      ru: "действие",
      fr: "acte",
      es: "acto",
      it: "atto",
      pt: "ato",
      nl: "handeling",
      pl: "działanie",
      ar: "التصرف",
      ja: "行動",
      ko: "행동",
      "zh-CN": "行动",
    });

    const moveTerms = Object.fromEntries(
      VOCABULARY_CARDS.filter((card) => card.englishKey === "move").map((card) => [card.language, card.term]),
    );
    expect(moveTerms).toEqual({
      tr: "hareket",
      en: "move",
      de: "Bewegung",
      ru: "движение",
      fr: "mouvement",
      es: "movimiento",
      it: "movimento",
      pt: "movimento",
      nl: "verplaatsing",
      pl: "ruch",
      ar: "حركة",
      ja: "動き",
      ko: "움직임",
      "zh-CN": "移动",
    });

    expect(CARD_PRONUNCIATIONS["ar:A2:word:advertise:verb"]).toBe("yu'lin");
    expect(CARD_PRONUNCIATIONS["tr:B2:word:depart:verb"]).toBe("hareket etmek");
    expect(CARD_PRONUNCIATIONS["fr:C1:word:displace:verb"]).toBe("deplase");
    expect(CARD_EXAMPLE_SENTENCES["tr:B2:word:depart:verb"]).toEqual([
      "Otobüs her sabah saat yedide terminalden hareket eder.",
      "Gemi limandan gün doğmadan hareket etti.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["fr:C1:word:displace:verb"]).toEqual([
      "La crue a déplacé plusieurs voitures dans la rue.",
      "Le propriétaire a déplacé les meubles pour libérer le passage.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ar:A2:word:advertise:verb"]).toEqual([
      "تُعلن الشركة عن خصومات كل شهر.",
      "قرر المتجر أن يعلن عن منتجه عبر الإنترنت.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["it:B1:word:act:noun"]).toEqual([
      "Un atto di gentilezza può migliorare la giornata di qualcuno.",
      "L’atto finale dello spettacolo ha emozionato il pubblico.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ru:B1:word:act:noun"]).toEqual([
      "Её действие изменило ход разговора.",
      "Этот поступок помог спасти ситуацию.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["es:B2:word:actual:adjective"]).toEqual([
      "La historia está basada en hechos reales.",
      "Su preocupación es real y debemos tomarla en serio.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["fr:A2:word:achieve:verb"]).toEqual([
      "Elle a réalisé son rêve de devenir médecin.",
      "Nous avons réalisé le projet avant la date prévue.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["fr:B1:word:achievement:noun"]).toEqual([
      "La réalisation de ce projet a demandé six mois de travail.",
      "Terminer ses études est une grande réalisation.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ko:A2:word:accept:verb"]).toEqual([
      "그는 회사의 제안을 수락했어요.",
      "학생들은 초대를 기쁘게 수락했습니다.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["zh-CN:A2:word:abroad:adverb"]).toEqual([
      "他已经在国外生活了五年。",
      "她在国外读大学，假期才回家。",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["zh-CN:B2:word:accompany:verb"]).toEqual([
      "父母会陪伴孩子一起成长。",
      "护士一直陪伴着病人，直到家人到来。",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["tr:B1:word:move:noun"]).toEqual([
      "Bu hareket, kalabalığın dikkatini çekti.",
      "Bir süre oturduktan sonra biraz hareket iyi geldi.",
    ]);
    expect(CARD_EXAMPLE_SENTENCES["ko:A2:word:behave:verb"]).toEqual([
      "그는 친구들에게 항상 친절하게 행동해요.",
      "공공장소에서는 예의 바르게 행동해야 해요.",
    ]);
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
      definitions: { en: "A card created by the learner.", tr: "Öğrenci tarafından oluşturulan kart." },
      grammar: { notes: ["Often used as an adjective."] },
      created_at: "2026-01-01T00:00:00Z",
    };
    const card = mapDbCustomCardToVocabularyCard(db);

    expect(card.id).toBe(db.source_key);
    expect(card.term).toBe("custom");
    expect(card.example).toBe("This is a custom card.");
    expect(card.definitionsByLocale?.en).toBe("A card created by the learner.");
    expect(card.definitionsByLocale?.tr).toBe("Öğrenci tarafından oluşturulan kart.");
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
      examples: [
        { sentence: "The journey was long.", translation: "Yolculuk uzundu." },
        { sentence: "Their journey began at sunrise.", translation: "Yolculukları gün doğumunda başladı." },
      ],
      definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "A journey from one place to another."])),
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
