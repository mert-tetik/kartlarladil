"use client";

import type { RefObject } from "react";
import type { GemReward, GemRewards, GemType } from "@/features/gems/gem-types";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import type { RewardScatterAnchor, RewardScatterPlacement } from "@/features/progress/reward-scatter";
import type { SoundEffectName } from "@/lib/sound-effects";

/** Compatibility wrapper; gem scatter geometry and rendering live in RewardScatter. */
export function GemRewardFlight({
  reward,
  rewards,
  sourceRef,
  sourceRefs,
  startDelayMs = 0,
  onComplete,
  onGemArrive,
  onGemLaunch,
  targetSelector = "[data-reward-gem-target]",
  arrivalSoundEffect = "gem-loot",
  sourceOrigin = "random",
}: {
  reward?: GemReward | null;
  rewards?: GemRewards | null;
  sourceRef: RefObject<HTMLElement | null>;
  startDelayMs?: number;
  onComplete?: () => void;
  onGemArrive?: (type: GemType, amountAwarded: number) => void;
  onGemLaunch?: (type: GemType) => void;
  sourceRefs?: Partial<Record<GemType, RefObject<HTMLElement | null>>>;
  targetSelector?: string;
  arrivalSoundEffect?: SoundEffectName;
  sourceOrigin?: "random" | "center";
}) {
  const rewardList = rewards?.length ? rewards : reward ? [reward] : [];
  if (rewardList.length === 0) return null;

  const sources = sourceRefs as Partial<Record<GemType, RewardScatterAnchor>> | undefined;
  const source = sourceRef as RewardScatterAnchor;
  const placement: RewardScatterPlacement = sourceOrigin === "center"
    ? { origin: "center" }
    : { origin: "random", spreadX: 0.55, spreadY: 0.35 };

  return (
    <RewardScatter
      gems={{
        rewards: rewardList,
        source,
        sources,
        targetSelector,
        startDelayMs,
        placement,
        iconSize: 40,
        zIndex: 112,
        arrivalSoundEffect,
      }}
      onGemLaunch={onGemLaunch}
      onGemArrive={onGemArrive}
      onGemsComplete={onComplete}
    />
  );
}
