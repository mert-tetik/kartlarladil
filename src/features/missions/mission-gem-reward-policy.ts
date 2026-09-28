import { GEM_POINTS, type GemType } from "@/features/gems/gem-types";

const GEM_TYPES_BY_DIFFICULTY: readonly (readonly GemType[])[] = [
  ["blue", "blue", "blue", "blue", "blue", "blue"],
  ["blue", "blue", "blue", "blue", "green", "green"],
  ["blue", "blue", "green", "green", "purple", "purple"],
  ["blue", "green", "green", "purple", "purple", "purple"],
  ["purple", "purple", "purple", "blue", "green", "purple"],
];

/** Stable reward ladder: each four-tier band contains progressively rarer gems. */
export function getMissionGemType(tier: number, missionIndex: number): GemType {
  const normalizedTier = Math.max(0, Math.floor(tier));
  const difficultyBand = Math.min(Math.floor(normalizedTier / 4), GEM_TYPES_BY_DIFFICULTY.length - 1);
  const firstTierInBand = difficultyBand * 4;
  let rewardPosition = 0;

  for (let previousTier = firstTierInBand; previousTier < normalizedTier; previousTier += 1) {
    rewardPosition += previousTier % 2 === 1 ? 2 : 1;
  }
  if (missionIndex % 4 === 3) rewardPosition += 1;

  const difficultyRewards = GEM_TYPES_BY_DIFFICULTY[difficultyBand];
  return difficultyRewards[Math.min(rewardPosition, difficultyRewards.length - 1)] ?? "purple";
}

export function createMissionGemReward(
  pointEquivalent: number,
  tier: number,
  missionIndex: number,
) {
  const gemType = getMissionGemType(tier, missionIndex);

  return {
    kind: "gems" as const,
    gemType,
    // Reduce the previous gem count by half, rounding up so every reward stays nonzero.
    amount: Math.max(1, Math.ceil(pointEquivalent / (GEM_POINTS[gemType] * 2))),
    pointEquivalent,
  };
}
