import type { Tier } from "@/types/domain";
import {
  CARD_SWIPE_TIER_ORDER,
  type TierRepeatCounts,
} from "@/features/cards/card-swipe-tier-behavior";

export function takeRandomCardsInTierOrder<T extends { tier: Tier }>(
  candidates: readonly T[],
  count: number,
  startingTierIndex: number,
  random: () => number = Math.random,
  tierRepeatCounts?: Partial<TierRepeatCounts>,
): { cards: T[]; nextTierIndex: number } {
  const tierSchedule = buildTierSchedule(tierRepeatCounts);
  const buckets = new Map<Tier, T[]>(CARD_SWIPE_TIER_ORDER.map((tier) => [tier, []]));
  for (const candidate of candidates) {
    buckets.get(candidate.tier)?.push(candidate);
  }

  const cards: T[] = [];
  let nextTierIndex = ((startingTierIndex % tierSchedule.length) + tierSchedule.length) % tierSchedule.length;

  while (cards.length < count) {
    let selectedTierIndex = -1;
    for (let offset = 0; offset < tierSchedule.length; offset += 1) {
      const candidateIndex = (nextTierIndex + offset) % tierSchedule.length;
      if ((buckets.get(tierSchedule[candidateIndex]!)?.length ?? 0) > 0) {
        selectedTierIndex = candidateIndex;
        break;
      }
    }

    if (selectedTierIndex < 0) break;

    const tier = tierSchedule[selectedTierIndex]!;
    const bucket = buckets.get(tier)!;
    const randomIndex = Math.min(bucket.length - 1, Math.floor(random() * bucket.length));
    cards.push(bucket.splice(randomIndex, 1)[0]!);
    nextTierIndex = (selectedTierIndex + 1) % tierSchedule.length;
  }

  return { cards, nextTierIndex };
}

function buildTierSchedule(tierRepeatCounts: Partial<TierRepeatCounts> = {}) {
  return CARD_SWIPE_TIER_ORDER.flatMap((tier) => {
    const configuredRepeatCount = tierRepeatCounts[tier] ?? 1;
    const repeatCount = Number.isFinite(configuredRepeatCount)
      ? Math.min(3, Math.max(1, Math.floor(configuredRepeatCount)))
      : 1;
    return Array.from({ length: repeatCount }, () => tier);
  });
}
