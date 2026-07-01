import { localCardRepository } from "@/features/cards/card-repository";
import type { Tier, VocabularyCard } from "@/types/domain";
import type { MemoryCardItem, WordChallengeItem } from "./game-types";

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomCards(tiers: Tier[], count: number): VocabularyCard[] {
  const pool = localCardRepository.list({ language: "all", tier: "all" }).filter((card) => tiers.includes(card.tier));

  if (pool.length === 0) {
    return [];
  }

  const shuffled = shuffle(pool);
  const result: VocabularyCard[] = [];
  const seen = new Set<string>();

  for (const card of shuffled) {
    if (result.length >= count) break;
    if (seen.has(card.sourceKey)) continue;
    seen.add(card.sourceKey);
    result.push(card);
  }

  return result;
}

export function generateMemoryCards(pairCount: number, tiers: Tier[]): MemoryCardItem[] {
  const uniqueCards = getRandomCards(tiers, pairCount);

  const items: MemoryCardItem[] = [];
  uniqueCards.forEach((card, index) => {
    const pairId = `pair-${index}`;
    items.push(
      {
        id: `${pairId}-a`,
        pairId,
        card,
        isFlipped: false,
        isMatched: false,
      },
      {
        id: `${pairId}-b`,
        pairId,
        card,
        isFlipped: false,
        isMatched: false,
      },
    );
  });

  return shuffle(items);
}

export function generateWordChallengeItems(questionCount: number, tiers: Tier[]): WordChallengeItem[] {
  const uniqueCards = getRandomCards(tiers, questionCount);
  const pool = localCardRepository.list({ language: "all", tier: "all" }).filter((card) => tiers.includes(card.tier));

  return uniqueCards.map((card) => {
    const isTrue = Math.random() >= 0.5;

    if (isTrue) {
      return { card, proposedMeaning: card.translation, isTrue: true };
    }

    const decoys = pool.filter((c) => c.sourceKey !== card.sourceKey && c.translation !== card.translation);
    const decoy = decoys.length > 0 ? decoys[Math.floor(Math.random() * decoys.length)] : card;
    return { card, proposedMeaning: decoy.translation, isTrue: false };
  });
}
