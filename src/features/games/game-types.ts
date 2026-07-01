import type { Tier, VocabularyCard } from "@/types/domain";

export type GameName = "memory" | "wordChallenge";

export interface GameProgress {
  currentLevel: number;
  bestLevel: number;
  totalPoints: number;
}

export type GamesProgress = Record<GameName, GameProgress>;

export interface GameLevelConfig {
  level: number;
  tiers: Tier[];
  seconds: number;
}

export interface MemoryCardItem {
  id: string;
  card: VocabularyCard;
  pairId: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface WordChallengeItem {
  card: VocabularyCard;
  proposedMeaning: string;
  isTrue: boolean;
}

export type GamePhase = "start" | "playing" | "completed" | "failed";
