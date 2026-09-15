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

export const CHEST_TIER_ARTWORK: Record<ChestTier, string> = {
  wood: "/chests/wooden_chest.png",
  iron: "/chests/iron_chest.png",
  gold: "/chests/gold_chest.png",
  diamond: "/chests/diamond_chest.png",
  emerald: "/chests/emerald_chest.png",
  ruby: "/chests/ruby_chest.png",
};

export const CHEST_TIER_OPENING_VIDEOS: Record<ChestTier, string> = {
  wood: "/chests/openings/wood_chest_opening_v2.mp4",
  iron: "/chests/openings/iron_chest_opening_v2.mp4",
  gold: "/chests/openings/golden_chest_opening_v2.mp4",
  diamond: "/chests/openings/diamond_chest_opening_v2.mp4",
  emerald: "/chests/openings/emerald_chest_opening_v2.mp4",
  ruby: "/chests/openings/ruby_chest_opening_v2.mp4",
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
