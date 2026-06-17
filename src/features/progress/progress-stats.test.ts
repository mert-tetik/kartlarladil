import { VOCABULARY_CARDS } from "@/data/cards";
import {
  RANKS,
  TIER_POINTS,
  calculateProgressStats,
  getNextRankProgress,
  getPointsForTier,
  getRankForPoints,
  mergeAiPracticePoints,
} from "@/features/progress/progress-stats";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";

describe("progress stats", () => {
  it("returns the configured tier points", () => {
    expect(TIER_POINTS).toEqual({ A1: 10, A2: 20, B1: 40, B2: 50, C1: 100 });
    expect(getPointsForTier("C1")).toBe(100);
  });

  it("calculates points only from learned cards and ignores duplicate card ids", () => {
    const a1Card = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;
    const b1Card = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "B1")!;
    const c1Card = VOCABULARY_CARDS.find((card) => card.language === "de" && card.tier === "C1")!;

    const stats = calculateProgressStats([
      learned(a1Card),
      learned(a1Card),
      active(b1Card),
      learned(c1Card),
    ]);

    expect(stats.totalCards).toBe(3);
    expect(stats.learnedCards).toBe(2);
    expect(stats.activeCards).toBe(1);
    expect(stats.totalPoints).toBe(110);
    expect(stats.tierStats.find((tier) => tier.tier === "A1")?.learned).toBe(1);
    expect(stats.tierStats.find((tier) => tier.tier === "B1")?.points).toBe(0);
    expect(stats.languageStats.find((language) => language.language === "de")?.points).toBe(100);
  });

  it("selects rank and next-rank progress from total points", () => {
    expect(getRankForPoints(0).label).toBe("Başlangıç");
    expect(getRankForPoints(300).label).toBe("Kelime Toplayıcı");

    const progress = getNextRankProgress(250);

    expect(progress.rank.label).toBe("Kart Çırağı");
    expect(progress.nextRank?.label).toBe("Kelime Toplayıcı");
    expect(progress.pointsToNextRank).toBe(50);
    expect(progress.rankProgressPercent).toBe(75);
  });

  it("assigns one stable icon id to each rank", () => {
    const iconIds = new Set(RANKS.map((rank) => rank.icon));

    expect(RANKS).toHaveLength(10);
    expect(iconIds.size).toBe(RANKS.length);
  });

  it("adds AI practice points to total points and recalculates rank", () => {
    const stats = calculateProgressStats([]);

    expect(stats.totalPoints).toBe(0);
    expect(stats.rank.label).toBe("Başlangıç");

    const merged = mergeAiPracticePoints(stats, 150);

    expect(merged.totalPoints).toBe(150);
    expect(merged.rank.label).toBe("Kart Çırağı");
    expect(merged.pointsToNextRank).toBe(150);
  });
});

function learned(card: InventoryCardView["card"]): InventoryCardView {
  return {
    card,
    inventory: {
      cardId: card.id,
      status: "learned",
      correctCount: 10,
      addedAt: "2026-01-01T00:00:00.000Z",
      learnedAt: "2026-01-02T00:00:00.000Z",
    },
  };
}

function active(card: InventoryCardView["card"]): InventoryCardView {
  return {
    card,
    inventory: {
      cardId: card.id,
      status: "active",
      correctCount: 1,
      addedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}
