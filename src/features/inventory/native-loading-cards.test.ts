import { VOCABULARY_CARDS } from "@/data/cards";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import {
  completeNativeLoadingCards,
  selectNativeLoadingDeckCards,
  selectNativeLoadingOfflineCards,
  selectNativeLoadingOfflineDeckCards,
  selectNativeLoadingVocabularyCards,
  selectNativeLoadingVocabularyCardsFromDeckCache,
} from "@/features/inventory/native-loading-cards";

describe("native loading card selection", () => {
  it("keeps the same cards for the same day and conditions", () => {
    const firstSelection = selectNativeLoadingVocabularyCards([], "en", "2026-10-31");
    const secondSelection = selectNativeLoadingVocabularyCards([], "en", "2026-10-31");

    expect(secondSelection.map((card) => card.sourceKey)).toEqual(firstSelection.map((card) => card.sourceKey));
    expect(firstSelection).toHaveLength(8);
    expect(new Set(firstSelection.map((card) => card.sourceKey)).size).toBe(8);
  });

  it("changes the catalog selection when the date changes", () => {
    const todaySelection = selectNativeLoadingVocabularyCards([], "en", "2026-10-31");
    const tomorrowSelection = selectNativeLoadingVocabularyCards([], "en", "2026-11-01");

    expect(tomorrowSelection.map((card) => card.sourceKey)).not.toEqual(todaySelection.map((card) => card.sourceKey));
  });

  it("uses the user's active deck cards before catalog fallback cards", () => {
    const deckCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.termKind === "word");
    if (!deckCard) throw new Error("Expected an English word card in the catalog");

    const selected = selectNativeLoadingVocabularyCards(
      [{ cardId: deckCard.id, status: "active", correctCount: 0, addedAt: "2026-10-31T00:00:00.000Z" }],
      "en",
      "2026-10-31",
    );

    expect(selected.map((card) => card.sourceKey)).toContain(deckCard.sourceKey);
    expect(selected).toHaveLength(8);
  });

  it("selects every available deck card, prioritizes unlearned cards, then fills from learned cards", () => {
    const cards = VOCABULARY_CARDS.filter((card) => card.language === "en" && card.termKind === "word").slice(0, 10);
    const inventory = [
      ...cards.slice(0, 8).map((card) => ({
        cardId: card.sourceKey,
        status: "learned" as const,
        correctCount: 4,
        addedAt: "2026-11-01T00:00:00.000Z",
      })),
      ...cards.slice(8).map((card) => ({
        cardId: card.sourceKey,
        status: "active" as const,
        correctCount: 1,
        addedAt: "2026-11-01T00:00:00.000Z",
      })),
    ];

    const selected = selectNativeLoadingDeckCards(inventory, "en", "tr", "2026-11-05", "user-1");

    expect(selected).toHaveLength(8);
    expect(selected.slice(0, 2).map((card) => card.sourceKey).sort()).toEqual(
      cards.slice(8).map((card) => card.sourceKey).sort(),
    );
    expect(selected.slice(2).every((card) => cards.slice(0, 8).some((deckCard) => deckCard.sourceKey === card.sourceKey))).toBe(true);
  });

  it("keeps actual deck cards separate from catalog fallback cards", () => {
    const englishWord = VOCABULARY_CARDS.find((card) => card.language === "en" && card.termKind === "word");
    if (!englishWord) throw new Error("Expected an English word card in the catalog");

    const deckCards = selectNativeLoadingDeckCards(
      [{ cardId: englishWord.sourceKey, status: "active", correctCount: 0, addedAt: "2026-11-05" }],
      englishWord.language,
      "tr",
      "2026-11-05",
    );
    const completed = completeNativeLoadingCards(deckCards, englishWord.language, "tr", "2026-11-05");

    expect(deckCards).toHaveLength(1);
    expect(completed).toHaveLength(8);
    expect(completed[0]?.sourceKey).toBe(deckCards[0]?.sourceKey);
    expect(new Set(completed.map((card) => card.sourceKey)).size).toBe(8);
  });

  it("tops a four-card deck up to eight distinct terms for the native carousel", () => {
    const deckCardsInCatalog = VOCABULARY_CARDS
      .filter((card) => card.language === "en" && card.termKind === "word")
      .slice(0, 4);
    const deckCards = selectNativeLoadingDeckCards(
      deckCardsInCatalog.map((card) => ({
        cardId: card.sourceKey,
        status: "active" as const,
        correctCount: 0,
        addedAt: "2026-11-05T00:00:00.000Z",
      })),
      "en",
      "tr",
      "2026-11-05",
      "user-with-four-cards",
    );

    const completed = completeNativeLoadingCards(deckCards, "en", "tr", "2026-11-05");

    expect(deckCards).toHaveLength(4);
    expect(completed).toHaveLength(8);
    expect(new Set(completed.map((card) => card.sourceKey)).size).toBe(8);
    expect(new Set(completed.map((card) => card.term.trim().toLowerCase())).size).toBe(8);
  });

  it("replaces repeated deck terms with unique catalog fallbacks", () => {
    const englishWord = VOCABULARY_CARDS.find((card) => card.language === "en" && card.termKind === "word");
    if (!englishWord) throw new Error("Expected an English word card in the catalog");
    const repeatedDeckCards = Array.from({ length: 4 }, (_, index) => ({
      sourceKey: `custom:duplicate-term-${index}`,
      term: englishWord.term,
      translation: englishWord.translation,
      pronunciation: englishWord.pronunciation,
      example: englishWord.example,
      tier: englishWord.tier,
    }));

    const completed = completeNativeLoadingCards(repeatedDeckCards, "en", "tr", "2026-11-05");

    expect(completed).toHaveLength(8);
    expect(new Set(completed.map((card) => card.term.trim().toLowerCase())).size).toBe(8);
  });

  it("uses cached deck cards in their saved order and fills missing visual-test slots from the catalog", () => {
    const deckCards = VOCABULARY_CARDS
      .filter((card) => card.language === "en" && card.termKind === "word")
      .slice(0, 3);
    const cachedCards = selectNativeLoadingDeckCards(
      deckCards.map((card) => ({
        cardId: card.sourceKey,
        status: "active" as const,
        correctCount: 0,
        addedAt: "2026-11-05T00:00:00.000Z",
      })),
      "en",
      "tr",
      "2026-11-05",
      "user-1",
    );

    const visualCards = selectNativeLoadingVocabularyCardsFromDeckCache(cachedCards, "en", "2026-11-05");

    expect(visualCards).toHaveLength(8);
    expect(visualCards.slice(0, 3).map((card) => card.sourceKey)).toEqual(
      cachedCards.map((card) => card.sourceKey),
    );
    expect(new Set(visualCards.map((card) => card.sourceKey)).size).toBe(8);
  });

  it("resolves a custom card stored by sourceKey in the user's deck", () => {
    const bundledCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.termKind === "word");
    if (!bundledCard) throw new Error("Expected an English word card in the catalog");
    const customCard = {
      ...bundledCard,
      id: "custom-card-1",
      sourceKey: "custom:user-1:custom-card-1",
      term: "custom term",
    };
    customCardRegistry.register(customCard);

    try {
      const selected = selectNativeLoadingDeckCards(
        [{ cardId: customCard.sourceKey, status: "active", correctCount: 0, addedAt: "2026-11-05" }],
        "en",
        "tr",
        "2026-11-05",
        "user-1",
      );

      expect(selected[0]?.sourceKey).toBe(customCard.sourceKey);
      expect(selected[0]?.term).toBe("custom term");
    } finally {
      customCardRegistry.unregister(customCard.sourceKey);
    }
  });

  it("uses active cards from the offline inventory snapshot before catalog fallback cards", () => {
    const deckCards = VOCABULARY_CARDS
      .filter((card) => card.language === "en" && card.termKind === "word")
      .slice(0, 4);
    const snapshot = deckCards.map((card) => ({
      inventory: {
        cardId: card.sourceKey,
        status: "active" as const,
        correctCount: 0,
        addedAt: "2026-10-31T00:00:00.000Z",
      },
      card: {
        id: card.id,
        sourceKey: card.sourceKey,
        language: card.language,
        tier: card.tier,
        termKind: card.termKind,
        term: card.term,
        translation: card.translation,
        translations: card.translations,
        pronunciation: card.pronunciation,
        partOfSpeech: card.partOfSpeech,
        example: card.example,
      },
    }));

    const learnedCards = VOCABULARY_CARDS
      .filter((card) => card.language === "en" && card.termKind === "word")
      .slice(4, 6);
    const learnedSnapshot = learnedCards.map((card) => ({
      inventory: {
        cardId: card.sourceKey,
        status: "learned" as const,
        correctCount: 4,
        addedAt: "2026-10-31T00:00:00.000Z",
      },
      card: {
        id: card.id,
        sourceKey: card.sourceKey,
        language: card.language,
        tier: card.tier,
        termKind: card.termKind,
        term: card.term,
        translation: card.translation,
        translations: card.translations,
        pronunciation: card.pronunciation,
        partOfSpeech: card.partOfSpeech,
        example: card.example,
      },
    }));
    const selectedDeckCards = selectNativeLoadingOfflineDeckCards(
      [...snapshot, ...learnedSnapshot],
      "en",
      "tr",
      "2026-10-31",
    );
    const selected = selectNativeLoadingOfflineCards([...snapshot, ...learnedSnapshot], "en", "tr", "2026-10-31");

    expect(selected).toHaveLength(8);
    expect(selectedDeckCards).toHaveLength(6);
    expect(selectedDeckCards.slice(0, 4).map((card) => card.sourceKey).sort()).toEqual(
      deckCards.map((card) => card.sourceKey).sort(),
    );
    expect(selectedDeckCards.slice(4).every((card) => learnedCards.some((learned) => learned.sourceKey === card.sourceKey))).toBe(true);
    expect(new Set(selected.map((card) => card.sourceKey)).size).toBe(8);
  });
});
