import { describe, expect, it } from "vitest";
import type { VocabularyCard } from "@/types/domain";
import "@/features/cards/components/offline-card-renderer-entry";

const card = {
  id: "offline-card-test",
  sourceKey: "offline-card-test",
  language: "ja",
  tier: "A1",
  termKind: "word",
  term: "木漏れ日",
  translation: "sunlight",
  translations: { en: "sunlight" },
  translationMeaningsByLocale: { en: ["sunlight", "dappled light"] },
  pronunciation: "komorebi",
  partOfSpeech: "noun",
  example: "木漏れ日がきれいです。",
  examples: [{ sentence: "木漏れ日がきれいです。", translation: "It is beautiful.", translations: { en: "It is beautiful." } }],
} as unknown as VocabularyCard;

describe("offline vocabulary-card renderer", () => {
  it("renders saved cards from the same shared visual design without external asset URLs", () => {
    const renderer = window.FoxiesDeckOfflineCardRenderer;
    expect(renderer).toBeDefined();

    const markup = renderer!.render(
      [{ card, inventory: { cardId: card.id, status: "active", correctCount: 2 } }],
      "en",
      { active: "In progress", learned: "Learned" },
    );

    expect(markup).toContain("fd-card-design__front");
    expect(markup).toContain("fd-card-design__back");
    expect(markup).toContain("木漏れ日");
    expect(markup).toContain("sunlight, dappled light");
    expect(markup).toContain("data-saved-card-status=\"active\"");
    expect(markup).toContain("2/4");
    expect(markup).not.toMatch(/(?:src|href)=\"https?:\/\//i);
  });

  it("keeps visual test fixtures with incomplete card records safe to render", () => {
    const fixtureCard = {
      ...card,
      translationMeaningsByLocale: undefined,
      id: undefined,
      examples: undefined,
    } as unknown as VocabularyCard;
    const markup = window.FoxiesDeckOfflineCardRenderer!.render(
      [{ card: fixtureCard, inventory: { cardId: "fixture-card", status: "learned", correctCount: 4 } }],
      "en",
      { active: "In progress", learned: "Learned" },
    );

    expect(markup).toContain('data-card-id="fixture-card"');
    expect(markup).toContain("fixture-card");
    expect(markup).toContain("data-saved-card-status=\"learned\"");
    expect(markup).toContain("木漏れ日");
  });
});
