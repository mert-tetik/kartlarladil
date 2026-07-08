import { describe, expect, it } from "vitest";
import { AI_PRACTICE_CHARACTER_IDS } from "@/features/ai-practice/ai-practice-data";
import { MISSIONS } from "./missions-data";
import {
  buildMissionViewModels,
  computeMissionProgress,
  countWaitingMissions,
  deriveMissionStatus,
} from "./mission-progress";
import type { MissionProgressSnapshot } from "./mission-types";

function makeSnapshot(overrides: Partial<MissionProgressSnapshot> = {}): MissionProgressSnapshot {
  return {
    totalCards: 0,
    learnedCards: 0,
    bestMemoryLevel: 0,
    bestWordChallengeLevel: 0,
    bestWordMatchLevel: 0,
    practicedCharacterIds: new Set(),
    ...overrides,
  };
}

describe("deriveMissionStatus", () => {
  it("returns waiting when progress meets requirement", () => {
    const mission = MISSIONS[0];
    expect(deriveMissionStatus(mission, mission.requirement)).toBe("waiting");
    expect(deriveMissionStatus(mission, mission.requirement + 10)).toBe("waiting");
  });

  it("returns locked when progress is below requirement", () => {
    const mission = MISSIONS[0];
    expect(deriveMissionStatus(mission, mission.requirement - 1)).toBe("locked");
  });
});

describe("computeMissionProgress", () => {
  it("counts total cards for add_cards missions", () => {
    const mission = MISSIONS.find((m) => m.type === "add_cards")!;
    expect(computeMissionProgress(mission, makeSnapshot({ totalCards: 12 }))).toBe(12);
  });

  it("counts learned cards for learn_cards missions", () => {
    const mission = MISSIONS.find((m) => m.type === "learn_cards")!;
    expect(computeMissionProgress(mission, makeSnapshot({ learnedCards: 5 }))).toBe(5);
  });

  it("counts best memory level for game_level missions", () => {
    const mission = MISSIONS.find((m) => m.type === "game_level" && m.game === "memory")!;
    expect(computeMissionProgress(mission, makeSnapshot({ bestMemoryLevel: 3 }))).toBe(3);
  });

  it("counts ai practice character presence", () => {
    const mission = MISSIONS.find((m) => m.type === "ai_practice")!;
    expect(computeMissionProgress(mission, makeSnapshot())).toBe(0);
    expect(
      computeMissionProgress(
        mission,
        makeSnapshot({ practicedCharacterIds: new Set([mission.characterId!]) }),
      ),
    ).toBe(1);
  });
});

describe("buildMissionViewModels", () => {
  it("renders all missions independently without sequential locking", () => {
    const snapshot = makeSnapshot({ totalCards: 100, learnedCards: 100 });
    const claimedIds = new Set([MISSIONS[0].id]);
    const viewModels = buildMissionViewModels(snapshot, claimedIds);

    expect(viewModels).toHaveLength(MISSIONS.length);

    const first = viewModels.find((vm) => vm.missionId === MISSIONS[0].id)!;
    expect(first.status).toBe("claimed");

    const second = viewModels.find((vm) => vm.missionId === MISSIONS[1].id)!;
    expect(second.status).toBe("waiting");

    const lastWaiting = viewModels.filter((vm) => vm.status === "waiting").length;
    expect(lastWaiting).toBeGreaterThan(1);
  });

  it("marks all claimed missions as claimed regardless of progress", () => {
    const snapshot = makeSnapshot();
    const claimedIds = new Set(MISSIONS.map((m) => m.id));
    const viewModels = buildMissionViewModels(snapshot, claimedIds);

    expect(viewModels.every((vm) => vm.status === "claimed")).toBe(true);
  });
});

describe("countWaitingMissions", () => {
  it("counts only waiting missions that are not claimed", () => {
    const snapshot = makeSnapshot({
      totalCards: 10_000,
      learnedCards: 10_000,
      bestMemoryLevel: 100,
      bestWordChallengeLevel: 100,
      bestWordMatchLevel: 100,
      practicedCharacterIds: new Set(AI_PRACTICE_CHARACTER_IDS),
    });
    const claimedIds = new Set([MISSIONS[0].id, MISSIONS[1].id]);
    const waiting = countWaitingMissions(snapshot, claimedIds);

    const claimedCount = 2;
    const expected = MISSIONS.length - claimedCount;
    expect(waiting).toBe(expected);
  });
});
