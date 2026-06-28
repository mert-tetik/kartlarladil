import { drawCardsFromDeck, markCardsAsDrawn } from "@/features/cards/draw-deck";
import type { LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";

const ALL_LOCALES: LocaleCode[] = [
  "tr",
  "en",
  "de",
  "ru",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ar",
  "ja",
  "ko",
  "zh-CN",
];

function fillLocales<T>(value: T): Record<LocaleCode, T> {
  return Object.fromEntries(ALL_LOCALES.map((locale) => [locale, value])) as Record<
    LocaleCode,
    T
  >;
}

function createCard(id: string, language: LanguageCode = "ko", tier: "A1" = "A1"): VocabularyCard {
  return {
    id,
    sourceKey: `ko:A1:word:${id}:noun`,
    englishKey: id,
    language,
    tier,
    termKind: "word",
    term: id,
    translation: id,
    translations: fillLocales(id),
    translationMeaningsByLocale: fillLocales([id]),
    partOfSpeech: "noun",
    pronunciation: "",
    example: id,
    exampleTranslation: id,
    examples: [],
    grammar: { summary: id, rules: [], details: [] },
    grammarByLocale: fillLocales({ summary: id, rules: [], details: [] }),
  };
}

describe("drawCardsFromDeck", () => {
  it("draws distinct cards across multiple calls without repetition until the cycle completes", () => {
    const cards = Array.from({ length: 10 }, (_, index) => createCard(`card-${index}`));
    const excluded = new Set<string>();

    const first = drawCardsFromDeck(null, 5, cards, excluded);
    expect(first.cards).toHaveLength(5);
    expect(new Set(first.cards.map((card) => card.id)).size).toBe(5);

    const second = drawCardsFromDeck(first.state, 3, cards, excluded);
    expect(second.cards).toHaveLength(3);

    const drawnIds = new Set([...first.cards, ...second.cards].map((card) => card.id));
    expect(drawnIds.size).toBe(8);

    for (const card of second.cards) {
      expect(drawnIds.has(card.id)).toBe(true);
      expect(first.cards.find((firstCard) => firstCard.id === card.id)).toBeUndefined();
    }
  });

  it("recycles the drawn pile when the remaining pile is exhausted", () => {
    const cards = Array.from({ length: 5 }, (_, index) => createCard(`card-${index}`));
    const excluded = new Set<string>();

    const first = drawCardsFromDeck(null, 5, cards, excluded);
    expect(first.state.remaining).toHaveLength(0);
    expect(first.state.drawn).toHaveLength(5);

    const second = drawCardsFromDeck(first.state, 3, cards, excluded);
    expect(second.cards).toHaveLength(3);
    expect(second.state.remaining).toHaveLength(2);
    expect(second.state.drawn).toHaveLength(3);

    for (const card of second.cards) {
      expect(first.cards.find((firstCard) => firstCard.id === card.id)).toBeDefined();
    }
  });

  it("excludes inventory cards from both remaining and drawn piles", () => {
    const cards = Array.from({ length: 5 }, (_, index) => createCard(`card-${index}`));
    const excluded = new Set(["card-0", "card-2"]);

    const result = drawCardsFromDeck(null, 10, cards, excluded);
    expect(result.cards).toHaveLength(3);
    expect(result.state.remaining).toHaveLength(0);
    expect(result.state.drawn).toHaveLength(3);

    for (const card of result.cards) {
      expect(excluded.has(card.id)).toBe(false);
    }
  });

  it("reconciles the deck against the current eligible pool", () => {
    const cards = Array.from({ length: 5 }, (_, index) => createCard(`card-${index}`));
    const first = drawCardsFromDeck(null, 2, cards, new Set());

    const smallerPool = cards.slice(0, 3);
    const result = drawCardsFromDeck(first.state, 10, smallerPool, new Set());

    for (const id of result.state.drawn) {
      expect(smallerPool.some((card) => card.id === id)).toBe(true);
    }
    for (const id of result.state.remaining) {
      expect(smallerPool.some((card) => card.id === id)).toBe(true);
    }
  });

  it("returns fewer cards than requested when the eligible pool is smaller than the count", () => {
    const cards = Array.from({ length: 3 }, (_, index) => createCard(`card-${index}`));
    const result = drawCardsFromDeck(null, 10, cards, new Set());
    expect(result.cards).toHaveLength(3);
    expect(result.state.remaining).toHaveLength(0);
  });
});

describe("markCardsAsDrawn", () => {
  it("moves the given ids from remaining to drawn", () => {
    const state = { remaining: ["a", "b", "c"], drawn: ["d"] };
    const next = markCardsAsDrawn(state, ["b"]);
    expect(next.remaining).toEqual(["a", "c"]);
    expect(next.drawn).toEqual(["d", "b"]);
  });

  it("creates a fresh deck state when none exists", () => {
    const next = markCardsAsDrawn(null, ["x"]);
    expect(next.remaining).toEqual([]);
    expect(next.drawn).toEqual(["x"]);
  });
});
