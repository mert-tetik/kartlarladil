import type { LanguageCode, Tier } from "@/types/domain";

export const CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY = 40;
export const CARD_SWIPE_TIER_BEHAVIOR_MIN_HISTORY = 5;
export const CARD_SWIPE_TIER_ORDER: readonly Tier[] = ["A1", "A2", "B1", "B2", "C1"];

const STORAGE_KEY_PREFIX = "foxiesdeck:card-swipe-tier-behavior:v1";
const STORAGE_VERSION = 1;

export type TierRepeatCounts = Record<Tier, number>;

interface StoredCardSwipeTierBehavior {
  version: typeof STORAGE_VERSION;
  recentAddedTiers: Tier[];
}

const DEFAULT_TIER_REPEAT_COUNTS: TierRepeatCounts = {
  A1: 1,
  A2: 1,
  B1: 1,
  B2: 1,
  C1: 1,
};

export function getCardSwipeTierBehaviorStorageKey(
  ownerUserId: string | null | undefined,
  language: LanguageCode,
) {
  const ownerKey = ownerUserId?.trim() || "guest";
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(ownerKey)}:${language}`;
}

export function readCardSwipeTierBehavior(
  storage: Pick<Storage, "getItem">,
  ownerUserId: string | null | undefined,
  language: LanguageCode,
): { recentAddedTiers: Tier[] } {
  try {
    const raw = storage.getItem(getCardSwipeTierBehaviorStorageKey(ownerUserId, language));
    if (!raw) return { recentAddedTiers: [] };

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredBehavior(parsed)) return { recentAddedTiers: [] };

    return { recentAddedTiers: parsed.recentAddedTiers.slice(-CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY) };
  } catch {
    return { recentAddedTiers: [] };
  }
}

export function recordCardSwipeTierAdded(
  storage: Pick<Storage, "getItem" | "setItem">,
  ownerUserId: string | null | undefined,
  language: LanguageCode,
  tier: Tier,
) {
  try {
    const current = readCardSwipeTierBehavior(storage, ownerUserId, language);
    const recentAddedTiers = [...current.recentAddedTiers, tier].slice(-CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY);
    const value: StoredCardSwipeTierBehavior = {
      version: STORAGE_VERSION,
      recentAddedTiers,
    };
    storage.setItem(getCardSwipeTierBehaviorStorageKey(ownerUserId, language), JSON.stringify(value));
  } catch {
    // localStorage can be unavailable or full. Tier selection must remain usable.
  }
}

export function getCardSwipeTierRepeatCounts(
  storage: Pick<Storage, "getItem">,
  ownerUserId: string | null | undefined,
  language: LanguageCode,
): TierRepeatCounts {
  const history = readCardSwipeTierBehavior(storage, ownerUserId, language).recentAddedTiers;
  if (history.length < CARD_SWIPE_TIER_BEHAVIOR_MIN_HISTORY) {
    return { ...DEFAULT_TIER_REPEAT_COUNTS };
  }

  const counts = getTierCounts(history);
  const sortedCounts = [...CARD_SWIPE_TIER_ORDER].map((tier) => counts[tier]).sort((a, b) => a - b);
  const baseline = Math.max(1, sortedCounts[Math.floor(sortedCounts.length / 2)] ?? 1);

  return Object.fromEntries(
    CARD_SWIPE_TIER_ORDER.map((tier) => {
      const count = counts[tier];
      const repeatCount = count >= baseline * 4 && count >= 3
        ? 3
        : count >= baseline * 2 && count >= 2
          ? 2
          : 1;
      return [tier, repeatCount];
    }),
  ) as TierRepeatCounts;
}

function getTierCounts(history: readonly Tier[]): TierRepeatCounts {
  const counts: TierRepeatCounts = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
  };
  for (const tier of history) {
    counts[tier] += 1;
  }
  return counts;
}

function isStoredBehavior(value: unknown): value is StoredCardSwipeTierBehavior {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StoredCardSwipeTierBehavior>;
  return candidate.version === STORAGE_VERSION
    && Array.isArray(candidate.recentAddedTiers)
    && candidate.recentAddedTiers.every(isTier);
}

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (CARD_SWIPE_TIER_ORDER as readonly string[]).includes(value);
}
