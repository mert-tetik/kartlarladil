import { getCardTranslationMeanings } from "@/features/cards/card-localization";
import type { MatchingBonusQuestion } from "@/features/quiz/bonus-questions";
import type { InventoryCard, LocaleCode, VocabularyCard } from "@/types/domain";

export const EASY_LEARNING_BATCH_SIZE = 5;

export interface EasyLearningCandidate {
  card: VocabularyCard;
  inventoryCard: InventoryCard | null;
  source: "pending" | "learned" | "active" | "catalog";
}

export function buildEasyLearningMatchingQuestion(
  candidates: EasyLearningCandidate[],
  uiLocale: LocaleCode,
  seed: string,
): MatchingBonusQuestion | null {
  if (candidates.length !== EASY_LEARNING_BATCH_SIZE) return null;

  const meaningsByCard = candidates.map(({ card }) =>
    getCardTranslationMeanings(card, uiLocale)
      .map((meaning) => meaning.trim())
      .filter(Boolean),
  );
  const selectedMeanings = new Array<string>(candidates.length);
  const usedMeanings = new Set<string>();

  function selectMeaning(index: number): boolean {
    if (index >= candidates.length) return true;

    for (const meaning of meaningsByCard[index] ?? []) {
      const normalized = normalizeMatchValue(meaning);
      if (!normalized || usedMeanings.has(normalized)) continue;
      usedMeanings.add(normalized);
      selectedMeanings[index] = meaning;
      if (selectMeaning(index + 1)) return true;
      usedMeanings.delete(normalized);
    }

    return false;
  }

  if (!selectMeaning(0)) {
    // A few common words genuinely share all available translations. Keep the
    // full five-card batch intact instead of dropping or postponing a card.
    meaningsByCard.forEach((meanings, index) => {
      selectedMeanings[index] = meanings[0] ?? candidates[index]!.card.translation;
    });
  }

  const pairs = candidates.map(({ card }, index) => ({
    id: `${seed}-pair-${index}`,
    cardId: card.id,
    term: card.term,
    meaning: selectedMeanings[index]!,
  }));

  return {
    kind: "matching",
    pairs,
    terms: shuffle(pairs),
    meanings: shuffle(pairs),
  };
}

function normalizeMatchValue(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}
