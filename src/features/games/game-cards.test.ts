import { generateMemoryCards, generateWordChallengeItems, generateWordMatchItems } from "./game-cards";

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

describe("generateWordMatchItems", () => {
  it("produces twice the requested pair count of items", () => {
    const items = generateWordMatchItems(4, ["A1"], "all");
    expect(items).toHaveLength(8);
  });

  it("creates one term and one meaning for each card", () => {
    const items = generateWordMatchItems(5, ["A1", "A2"], "all");
    const terms = items.filter((item) => item.side === "term");
    const meanings = items.filter((item) => item.side === "meaning");
    expect(terms).toHaveLength(5);
    expect(meanings).toHaveLength(5);

    const sourceKeys = new Set(items.map((item) => item.card.sourceKey));
    expect(sourceKeys.size).toBe(5);
  });

  it("initializes items as unmatched and unselected", () => {
    const items = generateWordMatchItems(3, ["A1"], "all");
    expect(items.every((item) => !item.matched && !item.selected && !item.shake)).toBe(true);
  });
});
