export type ChestTier = "wood" | "iron" | "gold" | "diamond" | "emerald" | "ruby";

export interface ChestTierDefinition {
  tier: ChestTier;
  count: number;
  points: number;
  labelKey: `chest.tier${Capitalize<ChestTier>}`;
}

export const CHEST_TIER_TEXT_CLASSES: Record<ChestTier, string> = {
  wood: "text-amber-800",
  iron: "text-slate-500",
  gold: "text-yellow-500",
  diamond: "text-cyan-400",
  emerald: "text-emerald-500",
  ruby: "text-red-500",
};

export const CHEST_TIER_BORDER_CLASSES: Record<ChestTier, string> = {
  wood: "border-amber-800",
  iron: "border-slate-500",
  gold: "border-yellow-500",
  diamond: "border-cyan-400",
  emerald: "border-emerald-500",
  ruby: "border-red-500",
};

export const CHEST_TIER_ARTWORK: Record<ChestTier, { bottom: string; top: string }> = {
  wood: { bottom: "/chests/wood-bottom.png", top: "/chests/wood-top.png" },
  iron: { bottom: "/chests/iron-bottom.png", top: "/chests/iron-top.png" },
  gold: { bottom: "/chests/gold-bottom.png", top: "/chests/gold-top.png" },
  diamond: { bottom: "/chests/diamond-bottom.png", top: "/chests/diamond-top.png" },
  emerald: { bottom: "/chests/emerald-bottom.png", top: "/chests/emerald-top.png" },
  ruby: { bottom: "/chests/ruby-bottom.png", top: "/chests/ruby-top.png" },
};

export const CHEST_TIERS: ChestTierDefinition[] = [
  { tier: "wood", count: 10, points: 20, labelKey: "chest.tierWood" },
  { tier: "iron", count: 20, points: 40, labelKey: "chest.tierIron" },
  { tier: "gold", count: 30, points: 60, labelKey: "chest.tierGold" },
  { tier: "diamond", count: 40, points: 90, labelKey: "chest.tierDiamond" },
  { tier: "emerald", count: 50, points: 130, labelKey: "chest.tierEmerald" },
  { tier: "ruby", count: 75, points: 200, labelKey: "chest.tierRuby" },
];

const TIER_BY_COUNT = new Map(CHEST_TIERS.map((tier) => [tier.count, tier]));

export function getChestTierByCount(count: number): ChestTierDefinition | undefined {
  return TIER_BY_COUNT.get(count);
}

export function resolveAwardedChestTier(count: number): ChestTierDefinition | undefined {
  const pair = getChestPreviewPairForCount(count);
  if (!pair) {
    return undefined;
  }

  const tier = Math.random() < 0.5 ? pair[0] : pair[1];
  return CHEST_TIERS.find((candidate) => candidate.tier === tier);
}

export function getChestFrameIndex(tapCount: number): number {
  return Math.min(6, tapCount * 2);
}

export function getChestRewardPoints(tier: ChestTier): number {
  return CHEST_TIERS.find((t) => t.tier === tier)?.points ?? 0;
}

export function getChestLabelKey(tier: ChestTier): `chest.tier${Capitalize<ChestTier>}` {
  const tierDef = CHEST_TIERS.find((t) => t.tier === tier);
  return tierDef?.labelKey ?? "chest.tierWood";
}

export const QUIZ_COUNT_OPTIONS = [10, 20, 30, 50] as const;

export const COUNT_CHEST_PREVIEW_PAIRS: Record<number, [ChestTier, ChestTier]> = {
  10: ["wood", "iron"],
  20: ["iron", "gold"],
  30: ["gold", "diamond"],
  50: ["emerald", "ruby"],
};

export function getChestPreviewPairForCount(count: number): [ChestTier, ChestTier] | undefined {
  return COUNT_CHEST_PREVIEW_PAIRS[count];
}
