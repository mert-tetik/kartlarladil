import { afterEach, describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { createOfflineInventorySnapshot } from "@/features/inventory/offline-inventory-snapshot";

describe("offline inventory snapshot", () => {
  afterEach(() => customCardRegistry.clear());

  it("saves cards from every language and keeps the native-language translation", () => {
    const spanish = VOCABULARY_CARDS.find((card) => card.language === "es")!;
    const english = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    const inventory = [
      { cardId: spanish.sourceKey, status: "active" as const, correctCount: 2, addedAt: "2026-01-01T00:00:00.000Z" },
      { cardId: english.sourceKey, status: "learned" as const, correctCount: 4, addedAt: "2026-01-02T00:00:00.000Z" },
    ];

    const snapshot = createOfflineInventorySnapshot({ inventory, nativeLanguage: "en" });

    expect(snapshot.complete).toBe(true);
    expect(snapshot.cards).toHaveLength(2);
    expect(snapshot.cards.map(({ card }) => card.language)).toEqual(["es", "en"]);
    expect(snapshot.cards[0]?.inventory.cardId).toBe(spanish.sourceKey);
    expect(snapshot.cards[0]?.card.translation).toBe(spanish.translations.en);
    expect(snapshot.cards[0]?.card.translations).toEqual({ en: spanish.translations.en });
    expect("grammar" in (snapshot.cards[0]?.card ?? {})).toBe(false);
  });

  it("keeps resolved cards from every language but marks the snapshot incomplete when an inventory ID cannot be resolved", () => {
    const spanish = VOCABULARY_CARDS.find((card) => card.language === "es")!;
    const snapshot = createOfflineInventorySnapshot({
      inventory: [
        { cardId: spanish.sourceKey, status: "active", correctCount: 0, addedAt: "2026-01-01T00:00:00.000Z" },
        { cardId: "missing-card-source-key", status: "active", correctCount: 0, addedAt: "2026-01-02T00:00:00.000Z" },
      ],
      nativeLanguage: "tr",
    });

    expect(snapshot.complete).toBe(false);
    expect(snapshot.cards.map(({ card }) => card.sourceKey)).toEqual([spanish.sourceKey]);
    expect(snapshot.cards[0]?.card.translation).toBe(spanish.translations.tr);
  });
});
