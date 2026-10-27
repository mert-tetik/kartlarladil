import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import type { InventoryCard } from "@/types/domain";
import {
  countActiveCardsForLanguage,
  limitCardIdsByLanguage,
} from "@/features/inventory/active-card-limits";

function inventoryCard(cardId: string, status: InventoryCard["status"] = "active"): InventoryCard {
  return { cardId, status, correctCount: 0, addedAt: "2026-01-01T00:00:00.000Z" };
}

describe("per-language active-card limits", () => {
  it("counts active cards within the requested language only", () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 20);
    const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;
    const inventory = [
      ...englishCards.map((card) => inventoryCard(card.sourceKey)),
      inventoryCard(germanCard.sourceKey),
      inventoryCard(englishCards[0]!.sourceKey, "learned"),
    ];

    expect(countActiveCardsForLanguage(inventory, "en")).toBe(20);
    expect(countActiveCardsForLanguage(inventory, "de")).toBe(1);
  });

  it("allocates independent slots for each language in a mixed batch", () => {
    const germanCards = VOCABULARY_CARDS.filter((card) => card.language === "de");
    const frenchCards = VOCABULARY_CARDS.filter((card) => card.language === "fr");
    const currentCards = germanCards.slice(0, 19).map((card) => inventoryCard(card.sourceKey));
    const requested = [germanCards[19]!, germanCards[20]!, frenchCards[0]!];

    const result = limitCardIdsByLanguage(
      requested.map((card) => card.sourceKey),
      currentCards,
      20,
    );

    expect(result.allowedCardIds).toEqual([germanCards[19]!.sourceKey, frenchCards[0]!.sourceKey]);
    expect(result.remainingCardIds).toEqual([germanCards[20]!.sourceKey]);
  });
});
