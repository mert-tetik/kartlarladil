import type { LanguageCode, Tier } from "@/types/domain";
import type { GameLevelConfig, GameName } from "./game-types";

const TIER_BASE_POINTS: Record<Tier, number> = {
  A1: 10,
  A2: 20,
  B1: 40,
  B2: 50,
  C1: 100,
};

export function getTiersForLevel(level: number): Tier[] {
  if (level <= 5) return ["A1"];
  if (level <= 10) return ["A1", "A2"];
  if (level <= 15) return ["A2"];
  if (level <= 20) return ["A2", "B1"];
  if (level <= 30) return ["B1"];
  if (level <= 40) return ["B1", "B2"];
  if (level <= 50) return ["B2"];
  if (level <= 75) return ["B2", "C1"];
  return ["C1"];
}

export function getHighestTierForLevel(level: number): Tier {
  const tiers = getTiersForLevel(level);
  // Tiers are ordered by difficulty in the returned arrays, so the last one is highest.
  return tiers[tiers.length - 1];
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
  if (level <= 5) return 8;
  if (level <= 10) return 12;
  if (level <= 15) return 16;
  if (level <= 25) return 20;
  return 24;
}

export function getMemoryPairCountForLevel(level: number): number {
  return getMemoryCardCountForLevel(level) / 2;
}

export function getLevelTimeLimit(level: number, game: GameName, cardCount?: number): number {
  if (game === "memory") {
    const count = cardCount ?? getMemoryCardCountForLevel(level);
    // 3 seconds per card.
    return count * 3;
  }
  // Word challenge: 10s base + 5s per question. 12 questions per level.
  return 10 + 12 * 5 + level;
}

export function buildLevelConfig(
  level: number,
  game: GameName,
  language: LanguageCode | "all" = "all",
): GameLevelConfig {
  const cardCount = game === "memory" ? getMemoryCardCountForLevel(level) : 12;
  return {
    level,
    tiers: getTiersForLevel(level),
    seconds: getLevelTimeLimit(level, game, cardCount),
    cardCount,
    language,
  };
}

export const FREE_GAME_LEVEL_LIMIT = 10;

export function isGameLevelLocked(level: number): boolean {
  return level > FREE_GAME_LEVEL_LIMIT;
}
