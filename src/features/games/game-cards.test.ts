import { generateMemoryCards, generateWordChallengeItems, WORD_CHALLENGE_QUESTION_COUNT } from "./game-cards";
describe("generateMemoryCards", () => {
  it("produces twice the requested pair count of cards", () => {
    const cards = generateMemoryCards(["A1"], 6);
    expect(cards).toHaveLength(12);
  });

  it("creates matching pairs", () => {
    const cards = generateMemoryCards(["A1"], 4);
    const pairs = new Map<string, number>();
    for (const card of cards) {
      pairs.set(card.pairId, (pairs.get(card.pairId) ?? 0) + 1);
    }
    expect(Array.from(pairs.values()).every((count) => count === 2)).toBe(true);
  });
});

describe("generateWordChallengeItems", () => {
  it("produces the expected number of questions", () => {
    const items = generateWordChallengeItems(["A1"]);
    expect(items).toHaveLength(WORD_CHALLENGE_QUESTION_COUNT);
  });

  it("includes both true and false statements", () => {
    const items = generateWordChallengeItems(["A1", "A2"]);
    const hasTrue = items.some((item) => item.isTrue);
    const hasFalse = items.some((item) => !item.isTrue);
    expect(hasTrue).toBe(true);
    expect(hasFalse).toBe(true);
  });
});
