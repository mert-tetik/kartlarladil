import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  createDeckCardTermIndex,
  getDraftsNotInDeck,
  getGeneratedCardTermKey,
} from "@/features/inventory/offline-notes-card-match";
import type { InventoryCard } from "@/types/domain";

describe("offline note duplicate card matching", () => {
  it("matches a card in the deck by language, term kind, and locale-aware term", () => {
    const existingCard = VOCABULARY_CARDS.find((card) => card.language === "tr" && card.termKind === "word")!;
    const inventory: InventoryCard[] = [
      {
        cardId: existingCard.id,
        status: "active",
        correctCount: 0,
        addedAt: "2026-10-17T00:00:00.000Z",
      },
    ];
    const deckIndex = createDeckCardTermIndex(inventory);

    expect(deckIndex.has(getGeneratedCardTermKey({
      language: existingCard.language,
      term: existingCard.term.toLocaleUpperCase("tr"),
      termKind: existingCard.termKind,
    }))).toBe(true);
  });

  it("does not treat a different language, term kind, or diacritic as the same card", () => {
    const base = { language: "tr" as const, term: "göl", termKind: "word" as const };
    const key = getGeneratedCardTermKey(base);

    expect(getGeneratedCardTermKey({ ...base, language: "en" })).not.toBe(key);
    expect(getGeneratedCardTermKey({ ...base, termKind: "fixed_phrase" })).not.toBe(key);
    expect(getGeneratedCardTermKey({ ...base, term: "gol" })).not.toBe(key);
  });

  it("excludes already-owned cards from the bulk-add queue", () => {
    const existing = { language: "en" as const, term: "serendipity", termKind: "word" as const };
    const drafts = [
      { id: "existing", draft: { generated: existing } },
      { id: "new", draft: { generated: { ...existing, term: "discovery" } } },
    ];

    expect(getDraftsNotInDeck(drafts, new Set([getGeneratedCardTermKey(existing)]))).toEqual([drafts[1]]);
  });
});
