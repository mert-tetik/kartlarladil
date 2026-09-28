import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";
import type { ChestRewardOutcome } from "@/features/gems/gem-types";
import type { GemBalances, GemType } from "@/features/gems/gem-types";

/** New reward animation kinds can join this FIFO without changing claim handling. */
export type MissionRewardAnimationMode =
  | { missionId: string; kind: "chest"; tier: ChestTierDefinition; gemReward?: ChestRewardOutcome }
  | { missionId: string; kind: "points"; amount: number; source?: DOMRect; claimSettled?: boolean }
  | { missionId: string; kind: "gems"; gemType: GemType; amount: number; source?: DOMRect; balances?: GemBalances };

export interface MissionRewardAnimationEntry {
  mode: MissionRewardAnimationMode;
  claimSettled: boolean;
  animationComplete: boolean;
}

export function enqueueMissionRewardAnimation(
  queue: MissionRewardAnimationEntry[],
  mode: MissionRewardAnimationMode,
  claimSettled = false,
): MissionRewardAnimationEntry[] {
  if (queue.some((entry) => entry.mode.missionId === mode.missionId)) return queue;

  return [...queue, { mode, claimSettled, animationComplete: false }];
}

export function settleMissionRewardAnimation(
  queue: MissionRewardAnimationEntry[],
  missionId: string,
  chestGemReward?: ChestRewardOutcome,
  gemBalances?: GemBalances,
): MissionRewardAnimationEntry[] {
  return pruneCompletedAnimations(queue.map((entry) => {
    if (entry.mode.missionId !== missionId) return entry;

    const mode = entry.mode.kind === "chest" && chestGemReward
      ? { ...entry.mode, gemReward: chestGemReward }
      : entry.mode.kind === "gems" && gemBalances
        ? { ...entry.mode, balances: gemBalances }
        : entry.mode.kind === "points"
          ? { ...entry.mode, claimSettled: true }
          : entry.mode;
    return { ...entry, mode, claimSettled: true };
  }));
}

export function completeMissionRewardAnimation(
  queue: MissionRewardAnimationEntry[],
  missionId: string,
): MissionRewardAnimationEntry[] {
  return pruneCompletedAnimations(queue.map((entry) => (
    entry.mode.missionId === missionId
      ? { ...entry, animationComplete: true }
      : entry
  )));
}

export function removeMissionRewardAnimation(
  queue: MissionRewardAnimationEntry[],
  missionId: string,
): MissionRewardAnimationEntry[] {
  return pruneCompletedAnimations(queue.filter((entry) => entry.mode.missionId !== missionId));
}

export function getActiveMissionRewardAnimations(
  queue: MissionRewardAnimationEntry[],
): MissionRewardAnimationMode[] {
  const activeScatters = queue
    .filter((entry) => !entry.animationComplete && (entry.mode.kind === "points" || entry.mode.kind === "gems"))
    .map((entry) => entry.mode);
  const activeChest = queue.find((entry) => !entry.animationComplete && entry.mode.kind === "chest");

  return activeChest ? [...activeScatters, activeChest.mode] : activeScatters;
}

function pruneCompletedAnimations(queue: MissionRewardAnimationEntry[]) {
  let firstPendingIndex = 0;
  while (
    firstPendingIndex < queue.length
    && queue[firstPendingIndex].claimSettled
    && queue[firstPendingIndex].animationComplete
  ) {
    firstPendingIndex += 1;
  }

  return firstPendingIndex === 0 ? queue : queue.slice(firstPendingIndex);
}
