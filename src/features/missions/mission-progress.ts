import { MISSIONS } from "./missions-data";
import type {
  MissionDefinition,
  MissionProgressSnapshot,
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
  previousMissionClaimed: boolean,
): MissionStatus {
  if (!previousMissionClaimed) {
    return "locked";
  }

  if (progress >= mission.requirement) {
    return "waiting";
  }

  return "locked";
}

export function buildMissionViewModels(
  snapshot: MissionProgressSnapshot,
  userMissions: UserMission[],
): Array<UserMission & { definition: MissionDefinition; requirement: number }> {
  const userMissionById = new Map(userMissions.map((item) => [item.missionId, item]));

  return MISSIONS.map((definition, index) => {
    const previousMission = MISSIONS[index - 1];
    const previousMissionClaimed = previousMission
      ? (userMissionById.get(previousMission.id)?.status === "claimed")
      : true;

    const stored = userMissionById.get(definition.id);
    const computedProgress = computeMissionProgress(definition, snapshot);

    if (stored?.status === "claimed") {
      return {
        missionId: definition.id,
        progress: Math.max(computedProgress, stored.progress),
        status: "claimed",
        claimedAt: stored.claimedAt,
        definition,
        requirement: definition.requirement,
      };
    }

    const status = deriveMissionStatus(definition, computedProgress, previousMissionClaimed);

    return {
      missionId: definition.id,
      progress: computedProgress,
      status,
      claimedAt: null,
      definition,
      requirement: definition.requirement,
    };
  });
}

export function countWaitingMissions(
  snapshot: MissionProgressSnapshot,
  userMissions: UserMission[],
): number {
  return buildMissionViewModels(snapshot, userMissions).filter((item) => item.status === "waiting")
    .length;
}
