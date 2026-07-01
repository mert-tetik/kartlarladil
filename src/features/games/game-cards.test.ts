import { generateMemoryCards, generateWordChallengeItems } from "./game-cards";

describe("generateMemoryCards", () => {
  it("produces twice the requested pair count of cards", () => {
    const cards = generateMemoryCards(6, ["A1"], "all");
    expect(cards).toHaveLength(12);
  });

  it("creates matching pairs", () => {
    const cards = generateMemoryCards(8, ["A1", "A2"], "all");
    const pairs = new Map<string, number>();
    for (const card of cards) {
      pairs.set(card.pairId, (pairs.get(card.pairId) ?? 0) + 1);
    }
    expect(Array.from(pairs.values()).every((count) => count === 2)).toBe(true);
  });
});

describe("generateWordChallengeItems", () => {
  it("produces the requested number of questions", () => {
    const items = generateWordChallengeItems(7, ["A1"], "all");
    expect(items).toHaveLength(7);
  });

  it("includes both true and false statements", () => {
    const items = generateWordChallengeItems(12, ["A1", "A2"], "all");
    const hasTrue = items.some((item) => item.isTrue);
    const hasFalse = items.some((item) => !item.isTrue);
    expect(hasTrue).toBe(true);
    expect(hasFalse).toBe(true);
  });
});
