import type { ChestTier } from "@/features/quiz/chest-rewards";
import type { GameName } from "@/features/games/game-types";

export type MissionType = "add_cards" | "learn_cards" | "game_level" | "ai_practice";

export type MissionStatus = "locked" | "waiting" | "claimed";

export interface MissionPointsReward {
  kind: "points";
  amount: number;
}

export interface MissionChestReward {
  kind: "chest";
  tier: ChestTier;
}

export type MissionReward = MissionPointsReward | MissionChestReward;

export interface MissionDefinition {
  id: string;
  index: number;
  type: MissionType;
  requirement: number;
  reward: MissionReward;
  game?: GameName;
  characterId?: string;
}

export interface UserMission {
  missionId: string;
  progress: number;
  status: MissionStatus;
  claimedAt: string | null;
}

export interface MissionProgressSnapshot {
  totalCards: number;
  learnedCards: number;
  bestMemoryLevel: number;
  bestWordChallengeLevel: number;
  bestWordMatchLevel: number;
  practicedCharacterIds: Set<string>;
}
