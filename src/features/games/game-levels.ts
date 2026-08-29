import type { LanguageCode, Tier } from "@/types/domain";
import type { GameLevelConfig, GameName } from "./game-types";

const TIER_BASE_POINTS: Record<Tier, number> = {
  A1: 10,
  A2: 20,
  B1: 40,
  B2: 50,
  C1: 100,
};

const TIER_ORDER: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

export function getHighestTierForLevel(level: number): Tier {
  if (level <= 10) return "A1";
  if (level <= 20) return "A2";
  if (level <= 30) return "B1";
  if (level <= 40) return "B2";
  return "C1";
}

export function getCardTiersForLevel(level: number): Tier[] {
  const highest = getHighestTierForLevel(level);
  const index = TIER_ORDER.indexOf(highest);
  return TIER_ORDER.slice(Math.max(0, index - 1), index + 1);
}

export function getPointsForLevel(level: number): number {
  const highestTier = getHighestTierForLevel(level);
  const base = TIER_BASE_POINTS[highestTier];
  // Small level multiplier beyond the free limit to keep higher levels rewarding.
  const multiplier =
    level <= FREE_GAME_LEVEL_LIMIT
      ? 1
      : 1 + Math.floor((level - FREE_GAME_LEVEL_LIMIT - 1) / 10) * 0.1;
  return Math.round(base * multiplier);
}

export function getMemoryCardCountForLevel(level: number): number {
  if (level <= 10) return 8;
  if (level <= 20) return 12;
  if (level <= 30) return 16;
  if (level <= 40) return 20;
  return 24;
}

export function getMemoryRevealDurationMs(cardCount: number): number {
  switch (cardCount) {
    case 8:
      return 3000;
    case 12:
      return 4000;
    case 16:
    case 20:
      return 6000;
    case 24:
      return 7000;
    default:
      return 4000;
  }
}

export function getWordChallengeQuestionCountForLevel(level: number): number {
  if (level <= 10) return 7;
  if (level <= 20) return 15;
  if (level <= 30) return 20;
  return 25;
}

export function getWordMatchPairCountForLevel(level: number): number {
  if (level <= 5) return 4;
  if (level <= 12) return 5;
  if (level <= 20) return 6;
  if (level <= 30) return 7;
  return 8;
}

export function getLevelTimeLimit(level: number, game: GameName): number {
  if (game === "memory") {
    const cardCount = getMemoryCardCountForLevel(level);
    return cardCount * 3;
  }
  if (game === "wordMatch") {
    return 30;
  }
  return getWordChallengeQuestionCountForLevel(level) * 3;
}

export function buildLevelConfig(
  level: number,
  game: GameName,
  language: LanguageCode | "all" = "all",
): GameLevelConfig {
  const cardCount = (() => {
    if (game === "memory") return getMemoryCardCountForLevel(level);
    if (game === "wordMatch") return getWordMatchPairCountForLevel(level);
    return getWordChallengeQuestionCountForLevel(level);
  })();

  return {
    level,
    tiers: getCardTiersForLevel(level),
    seconds: getLevelTimeLimit(level, game),
    cardCount,
    language,
  };
}

export const FREE_GAME_LEVEL_LIMIT = 15;

export function isGameLevelLocked(level: number): boolean {
  return level > FREE_GAME_LEVEL_LIMIT;
}
