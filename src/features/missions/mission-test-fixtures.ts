import { MISSIONS } from "./missions-data";
import type {
  MissionDefinition,
  MissionStatus,
  UserMission,
} from "./mission-types";

export interface MissionTestViewModel extends UserMission {
  definition: MissionDefinition;
  requirement: number;
}

const TEST_STATUSES: readonly MissionStatus[] = ["claimed", "waiting", "locked"];

function createSeededRandom(seed: number) {
  let state = (Math.trunc(seed) >>> 0) || 1;

  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 7), 61 | state) ^ state;
    value = value + Math.imul(value ^ (value >>> 14), 9 | value);
    return ((value ^ (value >>> 13)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function createStatusBag(count: number, random: () => number): MissionStatus[] {
  const statuses = Array.from({ length: count }, (_, index) => TEST_STATUSES[index % TEST_STATUSES.length]);
  return shuffle(statuses, random);
}

function ensureStatusAtIndex(statuses: MissionStatus[], index: number, status: MissionStatus) {
  if (index < 0 || index >= statuses.length) return;
  if (statuses[index] === status) return;

  const swapIndex = statuses.findIndex((candidate, candidateIndex) => candidate === status && candidateIndex !== index);
  if (swapIndex < 0) return;

  [statuses[index], statuses[swapIndex]] = [statuses[swapIndex]!, statuses[index]!];
}

export function createMissionTestViewModels(seed: number): MissionTestViewModel[] {
  const random = createSeededRandom(seed);
  const statuses = createStatusBag(MISSIONS.length, random);

  const firstChestIndex = MISSIONS.findIndex((mission) => mission.reward.kind === "chest");
  const firstPointsIndex = MISSIONS.findIndex((mission) => mission.reward.kind === "points");
  const firstGemIndex = MISSIONS.findIndex((mission) => mission.reward.kind === "gems");
  ensureStatusAtIndex(statuses, firstChestIndex, "waiting");
  ensureStatusAtIndex(statuses, firstPointsIndex, "waiting");
  ensureStatusAtIndex(statuses, firstGemIndex, "waiting");

  return MISSIONS.map((definition, index) => {
    const status = statuses[index]!;
    const progress = status === "locked"
      ? Math.floor(random() * definition.requirement)
      : definition.requirement;

    return {
      missionId: definition.id,
      progress,
      status,
      claimedAt: status === "claimed" ? "test-mode" : null,
      definition,
      requirement: definition.requirement,
    };
  });
}

export function normalizeMissionTestSeed(value: string | string[] | undefined, fallback: number): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return fallback;

  const numericValue = Number(rawValue);
  if (Number.isSafeInteger(numericValue)) {
    return (Math.abs(numericValue) || 1) >>> 0;
  }

  let hash = 2166136261;
  for (const character of rawValue) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) || fallback;
}
