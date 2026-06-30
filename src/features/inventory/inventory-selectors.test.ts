import { afterEach, describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { filterInventoryCards, joinInventoryCards } from "@/features/inventory/inventory-selectors";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

describe("inventory selectors", () => {
  afterEach(() => {
    customCardRegistry.clear();
  });

  it("joins inventory rows against registered custom cards", () => {
    const customCard: VocabularyCard = {
      ...VOCABULARY_CARDS[0]!,
      id: "custom:user-1:card-1",
      sourceKey: "custom:user-1:card-1",
      language: "de",
      term: "custom-term",
      translation: "custom",
      translations: {
        ...VOCABULARY_CARDS[0]!.translations,
        en: "custom",
        tr: "ozel",
      },
    };
    const inventory: InventoryCard[] = [
      {
        cardId: customCard.sourceKey,
        status: "active",
        correctCount: 0,
        addedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    customCardRegistry.register(customCard);

    expect(joinInventoryCards(inventory)).toEqual([{ inventory: inventory[0], card: customCard }]);
    expect(filterInventoryCards({ cards: inventory, language: "de", status: "active" })).toEqual([
      { inventory: inventory[0], card: customCard },
    ]);
  });
});
