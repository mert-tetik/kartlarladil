import { VOCABULARY_CARDS } from "@/data/cards";
import {
  selectNativeLoadingOfflineCards,
  selectNativeLoadingVocabularyCards,
} from "@/features/inventory/native-loading-cards";

describe("native loading card selection", () => {
  it("keeps the same cards for the same day and conditions", () => {
    const firstSelection = selectNativeLoadingVocabularyCards([], "en", "2026-10-31");
    const secondSelection = selectNativeLoadingVocabularyCards([], "en", "2026-10-31");

    expect(secondSelection.map((card) => card.sourceKey)).toEqual(firstSelection.map((card) => card.sourceKey));
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

    const selected = selectNativeLoadingOfflineCards(snapshot, "en", "tr", "2026-10-31");

    expect(selected).toHaveLength(4);
    expect(selected.map((card) => card.sourceKey).sort()).toEqual(
      deckCards.map((card) => card.sourceKey).sort(),
    );
  });
});
