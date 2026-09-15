import { getChestRewardPoints, type ChestTier } from "@/features/quiz/chest-rewards";
import type { ChestRewardOutcome, GemBalances, GemRewards, GemType } from "@/features/gems/gem-types";

type GemDropConfig = {
  chance: number;
  min: number;
  max: number;
};

type ChestGemDropConfig = Record<GemType, GemDropConfig>;

const CHEST_GEM_DROP_CONFIG: Record<ChestTier, ChestGemDropConfig> = {
  wood: {
    blue: { chance: 75, min: 1, max: 3 },
    green: { chance: 20, min: 1, max: 1 },
    purple: { chance: 5, min: 1, max: 1 },
  },
  iron: {
    blue: { chance: 80, min: 2, max: 4 },
    green: { chance: 30, min: 1, max: 2 },
    purple: { chance: 10, min: 1, max: 1 },
  },
  gold: {
    blue: { chance: 84, min: 3, max: 6 },
    green: { chance: 40, min: 1, max: 3 },
    purple: { chance: 18, min: 1, max: 1 },
  },
  diamond: {
    blue: { chance: 88, min: 5, max: 8 },
    green: { chance: 50, min: 1, max: 3 },
    purple: { chance: 28, min: 1, max: 2 },
  },
  emerald: {
    blue: { chance: 92, min: 8, max: 12 },
    green: { chance: 60, min: 1, max: 4 },
    purple: { chance: 40, min: 1, max: 2 },
  },
  ruby: {
    blue: { chance: 96, min: 10, max: 15 },
    green: { chance: 72, min: 1, max: 5 },
    purple: { chance: 55, min: 1, max: 3 },
  },
};

const GEM_TYPES: readonly GemType[] = ["blue", "green", "purple"];

function randomAmount(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFallbackGem(): GemType {
  const roll = Math.random() * 100;
  if (roll < 40) return "blue";
  if (roll < 75) return "green";
  return "purple";
}

/**
 * Creates a visual-only chest outcome using the same independent rolls and
 * ranges as the server chest reward function. It never mutates user state.
 */
export function createChestRewardPreview(tier: ChestTier): ChestRewardOutcome {
  const config = CHEST_GEM_DROP_CONFIG[tier];
  const rewards: GemRewards = [];

  for (const type of GEM_TYPES) {
    const drop = config[type];
    if (Math.random() * 100 < drop.chance) {
      rewards.push({ type, amount: randomAmount(drop.min, drop.max) });
    }
  }

  if (rewards.length === 0) {
    const type = pickFallbackGem();
    const drop = config[type];
    rewards.push({ type, amount: randomAmount(drop.min, drop.max) });
  }

  const balances: GemBalances = { blue: 0, green: 0, purple: 0 };
  for (const reward of rewards) {
    balances[reward.type] += reward.amount;
  }

  return {
    points: getChestRewardPoints(tier),
    rewards,
    balances,
  };
}
