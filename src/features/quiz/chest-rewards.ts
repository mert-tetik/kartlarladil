export type ChestTier = "wood" | "iron" | "bronze" | "silver" | "gold" | "diamond" | "legendary";

export interface ChestTierDefinition {
  tier: ChestTier;
  count: number;
  points: number;
  filter: string;
  labelKey: `chest.tier${Capitalize<ChestTier>}`;
}

export const CHEST_TIER_TEXT_CLASSES: Record<ChestTier, string> = {
  wood: "text-amber-800",
  iron: "text-slate-500",
  bronze: "text-orange-700",
  silver: "text-gray-400",
  gold: "text-yellow-500",
  diamond: "text-cyan-400",
  legendary: "text-purple-500",
};

export const CHEST_TIER_BORDER_CLASSES: Record<ChestTier, string> = {
  wood: "border-amber-800",
  iron: "border-slate-500",
  bronze: "border-orange-700",
  silver: "border-gray-400",
  gold: "border-yellow-500",
  diamond: "border-cyan-400",
  legendary: "border-purple-500",
};

export interface ChestTierUiClasses {
  base: string;
  lid: string;
  band: string;
  lock: string;
  glow: string;
}

export const CHEST_TIER_UI_CLASSES: Record<ChestTier, ChestTierUiClasses> = {
  wood: { base: "bg-amber-800", lid: "bg-amber-700", band: "bg-amber-900", lock: "bg-yellow-200", glow: "bg-amber-400" },
  iron: { base: "bg-slate-500", lid: "bg-slate-400", band: "bg-slate-600", lock: "bg-slate-200", glow: "bg-slate-300" },
  bronze: { base: "bg-orange-700", lid: "bg-orange-600", band: "bg-orange-800", lock: "bg-yellow-200", glow: "bg-orange-400" },
  silver: { base: "bg-gray-400", lid: "bg-gray-300", band: "bg-gray-500", lock: "bg-white", glow: "bg-gray-200" },
  gold: { base: "bg-yellow-500", lid: "bg-yellow-400", band: "bg-yellow-600", lock: "bg-yellow-100", glow: "bg-yellow-300" },
  diamond: { base: "bg-cyan-400", lid: "bg-cyan-300", band: "bg-cyan-500", lock: "bg-white", glow: "bg-cyan-200" },
  legendary: { base: "bg-purple-500", lid: "bg-purple-400", band: "bg-fuchsia-700", lock: "bg-yellow-200", glow: "bg-fuchsia-300" },
};

export const CHEST_TIERS: ChestTierDefinition[] = [
  { tier: "wood", count: 10, points: 20, filter: "none", labelKey: "chest.tierWood" },
  { tier: "iron", count: 20, points: 40, filter: "grayscale(60%) brightness(1.1)", labelKey: "chest.tierIron" },
  { tier: "bronze", count: 30, points: 60, filter: "sepia(60%) hue-rotate(-30deg) saturate(1.2)", labelKey: "chest.tierBronze" },
  { tier: "silver", count: 40, points: 90, filter: "grayscale(100%) brightness(1.25)", labelKey: "chest.tierSilver" },
  { tier: "gold", count: 50, points: 130, filter: "sepia(80%) saturate(1.5) brightness(1.15)", labelKey: "chest.tierGold" },
  { tier: "diamond", count: 75, points: 200, filter: "sepia(40%) hue-rotate(160deg) saturate(1.6) brightness(1.2)", labelKey: "chest.tierDiamond" },
  { tier: "legendary", count: 100, points: 300, filter: "sepia(50%) hue-rotate(260deg) saturate(1.8) brightness(1.15)", labelKey: "chest.tierLegendary" },
];

const TIER_BY_COUNT = new Map(CHEST_TIERS.map((tier) => [tier.count, tier]));

export function getChestTierByCount(count: number): ChestTierDefinition | undefined {
  return TIER_BY_COUNT.get(count);
}

export function getChestFrameIndex(tapCount: number): number {
  return Math.min(6, tapCount * 2);
}

export function getChestRewardPoints(tier: ChestTier): number {
  return CHEST_TIERS.find((t) => t.tier === tier)?.points ?? 0;
}
