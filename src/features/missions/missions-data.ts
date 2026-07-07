import type { MissionDefinition } from "./mission-types";

export const MISSIONS: MissionDefinition[] = [
  {
    id: "add_5_cards",
    index: 0,
    type: "add_cards",
    requirement: 5,
    reward: { kind: "chest", tier: "wood" },
  },
  {
    id: "learn_3_cards",
    index: 1,
    type: "learn_cards",
    requirement: 3,
    reward: { kind: "points", amount: 50 },
  },
  {
    id: "practice_with_clara",
    index: 2,
    type: "ai_practice",
    requirement: 1,
    reward: { kind: "points", amount: 75 },
    characterId: "gentle-companion",
  },
  {
    id: "add_15_cards",
    index: 3,
    type: "add_cards",
    requirement: 15,
    reward: { kind: "chest", tier: "bronze" },
  },
  {
    id: "reach_memory_level_5",
    index: 4,
    type: "game_level",
    requirement: 5,
    reward: { kind: "points", amount: 100 },
    game: "memory",
  },
  {
    id: "learn_10_cards",
    index: 5,
    type: "learn_cards",
    requirement: 10,
    reward: { kind: "chest", tier: "gold" },
  },
  {
    id: "practice_with_raven",
    index: 6,
    type: "ai_practice",
    requirement: 1,
    reward: { kind: "points", amount: 150 },
    characterId: "gothic-calm",
  },
  {
    id: "add_30_cards",
    index: 7,
    type: "add_cards",
    requirement: 30,
    reward: { kind: "chest", tier: "legendary" },
  },
];

export const MISSIONS_BY_ID = new Map(MISSIONS.map((mission) => [mission.id, mission]));
