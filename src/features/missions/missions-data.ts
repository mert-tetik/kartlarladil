import { AI_PRACTICE_CHARACTER_IDS } from "@/features/ai-practice/ai-practice-data";
import type { ChestTier } from "@/features/quiz/chest-rewards";
import type { GameName } from "@/features/games/game-types";
import type { MissionDefinition } from "./mission-types";

const GAME_NAMES: GameName[] = ["memory", "wordChallenge", "wordMatch"];

export const CHEST_MISSION_REWARD_TIERS: readonly ChestTier[] = [
  "wood",
  "iron",
  "wood",
  "iron",
  "iron",
  "gold",
  "iron",
  "gold",
  "gold",
  "diamond",
  "gold",
  "diamond",
  "diamond",
  "emerald",
  "diamond",
  "emerald",
  "emerald",
  "ruby",
  "emerald",
  "ruby",
];

export const MISSIONS: MissionDefinition[] = Array.from({ length: 80 }, (_, index) => {
  const cycle = index % 4;
  const tier = Math.floor(index / 4);
  const basePoints = 50 + tier * 25;

  switch (cycle) {
    case 0: {
      const requirement = Math.min(5 + tier * 5, 250);
      return {
        id: `add_cards_${index + 1}`,
        index,
        type: "add_cards",
        requirement,
        reward: {
          kind: "chest",
          tier: CHEST_MISSION_REWARD_TIERS[Math.floor(index / 4)],
        },
      };
    }
    case 1: {
      const requirement = Math.min(3 + tier * 3, 150);
      return {
        id: `learn_cards_${index + 1}`,
        index,
        type: "learn_cards",
        requirement,
        reward: { kind: "points", amount: basePoints },
      };
    }
    case 2: {
      const game = GAME_NAMES[tier % GAME_NAMES.length];
      const requirement = Math.min(3 + (tier % 6) * 2, 25);
      return {
        id: `game_level_${game}_${index + 1}`,
        index,
        type: "game_level",
        requirement,
        game,
        reward: { kind: "points", amount: basePoints + 25 },
      };
    }
    case 3: {
      const characterId = AI_PRACTICE_CHARACTER_IDS[tier % AI_PRACTICE_CHARACTER_IDS.length];
      return {
        id: `ai_practice_${characterId}_${index + 1}`,
        index,
        type: "ai_practice",
        requirement: 1,
        characterId,
        reward: { kind: "points", amount: basePoints + 50 },
      };
    }
    default:
      throw new Error("Unexpected mission cycle");
  }
});

export const MISSIONS_BY_ID = new Map(MISSIONS.map((mission) => [mission.id, mission]));
