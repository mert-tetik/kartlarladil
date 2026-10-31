import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";
import type { ChestRewardOutcome } from "@/features/gems/gem-types";
import type { GemBalances, GemType } from "@/features/gems/gem-types";

/** New reward animation kinds can join this FIFO without changing claim handling. */
export type MissionRewardAnimationMode =
  | { missionId: string; kind: "chest"; tier: ChestTierDefinition; gemReward?: ChestRewardOutcome; animationComplete?: boolean }
  | { missionId: string; kind: "points"; amount: number; source?: DOMRect; claimSettled?: boolean; animationComplete?: boolean }
  | { missionId: string; kind: "gems"; gemType: GemType; amount: number; source?: DOMRect; balances?: GemBalances; claimSettled?: boolean; animationComplete?: boolean };

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
      : entry.mode.kind === "gems"
        ? { ...entry.mode, ...(gemBalances ? { balances: gemBalances } : {}), claimSettled: true }
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

/** Includes completed scatters whose server claim is pending so their HUD total stays visible. */
export function getMissionRewardOverlayModes(
  queue: MissionRewardAnimationEntry[],
): MissionRewardAnimationMode[] {
  const scatterModes = queue
    .filter((entry) => (
      (entry.mode.kind === "points" || entry.mode.kind === "gems")
      && (!entry.animationComplete || !entry.claimSettled)
    ))
    .map((entry) => ({ ...entry.mode, animationComplete: entry.animationComplete }));
  const activeChest = queue.find((entry) => !entry.animationComplete && entry.mode.kind === "chest");

  return activeChest ? [...scatterModes, activeChest.mode] : scatterModes;
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
