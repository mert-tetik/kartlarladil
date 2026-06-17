import { LANGUAGES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type {
  LanguageCode,
  ProgressStats,
  RankDefinition,
  Tier,
  TierPoints,
} from "@/types/domain";

export const TIER_POINTS: TierPoints = {
  A1: 10,
  A2: 20,
  B1: 40,
  B2: 50,
  C1: 100,
};

export const RANKS: RankDefinition[] = [
  { id: "baslangic", label: "Başlangıç", minPoints: 0, icon: "trophy" },
  { id: "kart-ciragi", label: "Kart Çırağı", minPoints: 100, icon: "medal" },
  { id: "kelime-toplayici", label: "Kelime Toplayıcı", minPoints: 300, icon: "book" },
  { id: "dil-yolcusu", label: "Dil Yolcusu", minPoints: 700, icon: "compass" },
  { id: "akici-ogrenci", label: "Akıcı Öğrenci", minPoints: 1400, icon: "graduation" },
  { id: "kelime-ustasi", label: "Kelime Ustası", minPoints: 2500, icon: "star" },
  { id: "cok-dilli", label: "Çok Dilli", minPoints: 4500, icon: "languages" },
  { id: "seckin-koleksiyoncu", label: "Seçkin Koleksiyoncu", minPoints: 7500, icon: "gem" },
  { id: "dil-bilgesi", label: "Dil Bilgesi", minPoints: 12000, icon: "crown" },
  { id: "efsane", label: "Efsane", minPoints: 18000, icon: "flame" },
];

export const EMPTY_PROGRESS_STATS = calculateProgressStats([]);

export function getPointsForTier(tier: Tier) {
  return TIER_POINTS[tier];
}

export function getRankForPoints(points: number) {
  return [...RANKS].reverse().find((rank) => points >= rank.minPoints) ?? RANKS[0];
}

export function getNextRankProgress(points: number) {
  const rank = getRankForPoints(points);
  const nextRank = RANKS.find((candidate) => candidate.minPoints > points) ?? null;

  if (!nextRank) {
    return {
      rank,
      nextRank,
      pointsToNextRank: 0,
      rankProgressPercent: 100,
    };
  }

  const currentFloor = rank.minPoints;
  const needed = nextRank.minPoints - currentFloor;
  const earned = Math.max(0, points - currentFloor);

  return {
    rank,
    nextRank,
    pointsToNextRank: Math.max(0, nextRank.minPoints - points),
    rankProgressPercent: Math.min(100, Math.round((earned / needed) * 100)),
  };
}

export function calculateProgressStats(items: InventoryCardView[]): ProgressStats {
  const uniqueCards = uniqueInventoryCards(items);
  const tierStats = TIERS.map((tier) => ({ tier, total: 0, learned: 0, points: 0 }));
  const languageStats = LANGUAGES.map((language) => ({
    language: language.code,
    total: 0,
    learned: 0,
    points: 0,
  }));

  let totalPoints = 0;
  let learnedCards = 0;

  for (const item of uniqueCards) {
    const tierStat = tierStats.find((stat) => stat.tier === item.card.tier);
    const languageStat = languageStats.find((stat) => stat.language === item.card.language);

    tierStat!.total += 1;
    languageStat!.total += 1;

    if (item.inventory.status !== "learned") {
      continue;
    }

    const points = getPointsForTier(item.card.tier);
    learnedCards += 1;
    totalPoints += points;
    tierStat!.learned += 1;
    tierStat!.points += points;
    languageStat!.learned += 1;
    languageStat!.points += points;
  }

  const rankProgress = getNextRankProgress(totalPoints);

  return {
    totalPoints,
    totalCards: uniqueCards.length,
    activeCards: uniqueCards.length - learnedCards,
    learnedCards,
    tierStats,
    languageStats: languageStats as Array<{
      language: LanguageCode;
      total: number;
      learned: number;
      points: number;
    }>,
    ...rankProgress,
  };
}

export function mergeAiPracticePoints(stats: ProgressStats, aiPracticePoints: number): ProgressStats {
  if (aiPracticePoints <= 0) {
    return stats;
  }

  const totalPoints = stats.totalPoints + aiPracticePoints;
  const rankProgress = getNextRankProgress(totalPoints);

  return {
    ...stats,
    totalPoints,
    ...rankProgress,
  };
}

function uniqueInventoryCards(items: InventoryCardView[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.card.id)) {
      return false;
    }

    seen.add(item.card.id);
    return true;
  });
}
