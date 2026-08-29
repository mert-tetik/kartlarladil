import { MISSIONS } from "./missions-data";
import type {
  MissionDefinition,
  MissionProgressSnapshot,
  MissionRewardOverrides,
  MissionStatus,
  UserMission,
} from "./mission-types";

export function computeMissionProgress(
  mission: MissionDefinition,
  snapshot: MissionProgressSnapshot,
): number {
  switch (mission.type) {
    case "add_cards":
      return snapshot.totalCards;
    case "learn_cards":
      return snapshot.learnedCards;
    case "game_level": {
      if (!mission.game) return 0;
      switch (mission.game) {
        case "memory":
          return snapshot.bestMemoryLevel;
        case "wordChallenge":
          return snapshot.bestWordChallengeLevel;
        case "wordMatch":
          return snapshot.bestWordMatchLevel;
        default:
          return 0;
      }
    }
    case "ai_practice": {
      if (!mission.characterId) return 0;
      return snapshot.practicedCharacterIds.has(mission.characterId) ? 1 : 0;
    }
    default:
      return 0;
  }
}

export function deriveMissionStatus(
  mission: MissionDefinition,
  progress: number,
): MissionStatus {
  if (progress >= mission.requirement) {
    return "waiting";
  }

  return "locked";
}

export function buildMissionViewModels(
  snapshot: MissionProgressSnapshot,
  claimedMissionIds: Set<string>,
  rewardOverrides?: MissionRewardOverrides,
): Array<UserMission & { definition: MissionDefinition; requirement: number }> {
  return MISSIONS.map((definition) => {
    const computedProgress = computeMissionProgress(definition, snapshot);

    if (claimedMissionIds.has(definition.id)) {
      const historicalReward = rewardOverrides?.get(definition.id);
      const displayDefinition = historicalReward
        ? { ...definition, reward: historicalReward }
        : definition;

      return {
        missionId: definition.id,
        progress: Math.max(computedProgress, definition.requirement),
        status: "claimed" as const,
        claimedAt: null,
        definition: displayDefinition,
        requirement: definition.requirement,
      };
    }

    return {
      missionId: definition.id,
      progress: computedProgress,
      status: deriveMissionStatus(definition, computedProgress),
      claimedAt: null,
      definition,
      requirement: definition.requirement,
    };
  });
}

export function countWaitingMissions(
  snapshot: MissionProgressSnapshot,
  claimedMissionIds: Set<string>,
): number {
  return buildMissionViewModels(snapshot, claimedMissionIds).filter((item) => item.status === "waiting")
    .length;
}
