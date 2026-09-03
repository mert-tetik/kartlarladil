export type GemType = "blue" | "green" | "purple";

export interface GemBalances {
  blue: number;
  green: number;
  purple: number;
}

export interface GemReward {
  type: GemType;
  amount: number;
}

export interface ChestRewardOutcome {
  points: number;
  gem: GemReward;
  balances?: GemBalances;
}

export const GEM_POINTS: Record<GemType, number> = { blue: 1, green: 5, purple: 20 };
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
