import type { Tier } from "@/types/domain";

const TIER_CYCLE: readonly Tier[] = ["A1", "A2", "B1", "B2", "C1"];

export function takeRandomCardsInTierOrder<T extends { tier: Tier }>(
  candidates: readonly T[],
  count: number,
  startingTierIndex: number,
  random: () => number = Math.random,
): { cards: T[]; nextTierIndex: number } {
  const buckets = new Map<Tier, T[]>(TIER_CYCLE.map((tier) => [tier, []]));
  for (const candidate of candidates) {
    buckets.get(candidate.tier)?.push(candidate);
  }

  const cards: T[] = [];
  let nextTierIndex = ((startingTierIndex % TIER_CYCLE.length) + TIER_CYCLE.length) % TIER_CYCLE.length;

  while (cards.length < count) {
    let selectedTierIndex = -1;
    for (let offset = 0; offset < TIER_CYCLE.length; offset += 1) {
      const candidateIndex = (nextTierIndex + offset) % TIER_CYCLE.length;
      if ((buckets.get(TIER_CYCLE[candidateIndex]!)?.length ?? 0) > 0) {
        selectedTierIndex = candidateIndex;
        break;
      }
    }

    if (selectedTierIndex < 0) break;

    const tier = TIER_CYCLE[selectedTierIndex]!;
    const bucket = buckets.get(tier)!;
    const randomIndex = Math.min(bucket.length - 1, Math.floor(random() * bucket.length));
    cards.push(bucket.splice(randomIndex, 1)[0]!);
    nextTierIndex = (selectedTierIndex + 1) % TIER_CYCLE.length;
  }

  return { cards, nextTierIndex };
}
