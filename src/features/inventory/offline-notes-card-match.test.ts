import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  areOfflineNotesSafeToCloseWithoutConfirmation,
  createDeckCardTermIndex,
  getDraftsBlockedByActiveCardLimit,
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

  it("blocks a single draft when its language already has twenty active cards", () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 20);
    const inventory: InventoryCard[] = englishCards.map((card) => ({
      cardId: card.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "2026-10-17T00:00:00.000Z",
    }));
    const draft = { id: "english-draft", draft: { generated: { language: "en" as const } } };

    expect(getDraftsBlockedByActiveCardLimit([draft], inventory, 20)).toEqual([draft]);
  });

  it("blocks the entire bulk operation if any sequential addition would exceed a language quota", () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 19);
    const inventory: InventoryCard[] = englishCards.map((card) => ({
      cardId: card.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "2026-10-17T00:00:00.000Z",
    }));
    const drafts = [
      { id: "first", draft: { generated: { language: "en" as const } } },
      { id: "second", draft: { generated: { language: "en" as const } } },
      { id: "other-language", draft: { generated: { language: "de" as const } } },
    ];

    expect(getDraftsBlockedByActiveCardLimit(drafts, inventory, 20)).toEqual([drafts[1]]);
  });

  it("keeps language quotas independent and treats a null limit as unlimited", () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 20);
    const inventory: InventoryCard[] = englishCards.map((card) => ({
      cardId: card.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "2026-10-17T00:00:00.000Z",
    }));
    const germanDraft = { id: "german-draft", draft: { generated: { language: "de" as const } } };

    expect(getDraftsBlockedByActiveCardLimit([germanDraft], inventory, 20)).toEqual([]);
    expect(getDraftsBlockedByActiveCardLimit([germanDraft], inventory, null)).toEqual([]);
  });

  it("skips the discard confirmation only when every note card is safely in the deck", () => {
    const safeState = {
      canCheckDeck: true,
      visibleNoteCount: 0,
      addableDraftCount: 0,
      hasPendingAdds: false,
    };

    expect(areOfflineNotesSafeToCloseWithoutConfirmation(safeState)).toBe(true);
    expect(areOfflineNotesSafeToCloseWithoutConfirmation({ ...safeState, canCheckDeck: false })).toBe(false);
    expect(areOfflineNotesSafeToCloseWithoutConfirmation({ ...safeState, visibleNoteCount: 1 })).toBe(false);
    expect(areOfflineNotesSafeToCloseWithoutConfirmation({ ...safeState, addableDraftCount: 1 })).toBe(false);
    expect(areOfflineNotesSafeToCloseWithoutConfirmation({ ...safeState, hasPendingAdds: true })).toBe(false);
  });
});
