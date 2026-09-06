export type GemType = "blue" | "green" | "purple";
export type ProgressGemRewardSource = "game-level" | "quiz-streak" | "quiz-result";

export interface GemBalances {
  blue: number;
  green: number;
  purple: number;
}

export interface GemReward {
  type: GemType;
  amount: number;
}

export type GemRewards = GemReward[];

export function getGemBalancesBeforeRewards(
  balances: GemBalances | null | undefined,
  rewards: GemRewards | null | undefined,
): GemBalances | null {
  if (!balances) return null;

  const rewardByType = new Map<GemType, number>();
  for (const reward of rewards ?? []) {
    rewardByType.set(reward.type, (rewardByType.get(reward.type) ?? 0) + reward.amount);
  }

  return {
    blue: Math.max(0, balances.blue - (rewardByType.get("blue") ?? 0)),
    green: Math.max(0, balances.green - (rewardByType.get("green") ?? 0)),
    purple: Math.max(0, balances.purple - (rewardByType.get("purple") ?? 0)),
  };
}

export interface ChestRewardOutcome {
  points: number;
  rewards: GemRewards;
  balances?: GemBalances;
}

export const GEM_POINTS: Record<GemType, number> = { blue: 5, green: 20, purple: 40 };
export const GEM_ASSETS: Record<GemType, string> = {
  blue: "/gems/blue-gem.png",
  green: "/gems/green-gem.png",
  purple: "/gems/purple-gem.png",
};

export const GEM_COSTS = {
  removeCard: { type: "blue", amount: 10 } satisfies { type: GemType; amount: number },
  markLearned: { type: "purple", amount: 2 } satisfies { type: GemType; amount: number },
  rerollQuestion: { type: "green", amount: 2 } satisfies { type: GemType; amount: number },
} as const;

export function normalizeGemRewards(value: unknown): GemRewards {
  if (!Array.isArray(value)) return [];

  const byType = new Map<GemType, number>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as { type?: unknown; amount?: unknown };
    if (
      (candidate.type !== "blue" && candidate.type !== "green" && candidate.type !== "purple") ||
      !Number.isInteger(candidate.amount) ||
      Number(candidate.amount) <= 0
    ) {
      return;
    }
    const type = candidate.type as GemType;
    if (!byType.has(type)) byType.set(type, Number(candidate.amount));
  });

  return (["blue", "green", "purple"] as const).flatMap((type) => {
    const amount = byType.get(type);
    return amount === undefined ? [] : [{ type, amount }];
  });
}
