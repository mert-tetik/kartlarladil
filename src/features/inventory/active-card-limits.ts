import { isLanguageCode } from "@/data/languages";
import { localCardRepository } from "@/features/cards/card-repository";
import type { InventoryCard, LanguageCode } from "@/types/domain";

export function getInventoryCardLanguage(cardId: string): LanguageCode | null {
  const [prefix, secondPart] = cardId.split(":", 2);
  const sourceLanguage = prefix === "social-studio" ? secondPart : prefix;

  if (sourceLanguage && isLanguageCode(sourceLanguage)) {
    return sourceLanguage;
  }

  return localCardRepository.findById(cardId)?.language ?? null;
}

export function countActiveCardsForLanguage(
  cards: readonly InventoryCard[],
  language: LanguageCode,
): number {
  return cards.reduce((count, card) => (
    card.status === "active" && getInventoryCardLanguage(card.cardId) === language
      ? count + 1
      : count
  ), 0);
}

export function limitCardIdsByLanguage(
  requestedCardIds: readonly string[],
  currentCards: readonly InventoryCard[],
  perLanguageLimit: number | null,
): { allowedCardIds: string[]; remainingCardIds: string[] } {
  if (perLanguageLimit === null) {
    return { allowedCardIds: [...requestedCardIds], remainingCardIds: [] };
  }

  const activeCounts = new Map<LanguageCode, number>();
  for (const card of currentCards) {
    if (card.status !== "active") continue;
    const language = getInventoryCardLanguage(card.cardId);
    if (!language) continue;
    activeCounts.set(language, (activeCounts.get(language) ?? 0) + 1);
  }

  const allowedCardIds: string[] = [];
  const remainingCardIds: string[] = [];

  for (const cardId of requestedCardIds) {
    const language = getInventoryCardLanguage(cardId);
    if (!language) {
      // Unknown IDs are validated by the server; don't let a client-side guess
      // block a valid card from another language.
      allowedCardIds.push(cardId);
      continue;
    }

    const activeCount = activeCounts.get(language) ?? 0;
    if (activeCount >= perLanguageLimit) {
      remainingCardIds.push(cardId);
      continue;
    }

    allowedCardIds.push(cardId);
    activeCounts.set(language, activeCount + 1);
  }

  return { allowedCardIds, remainingCardIds };
}
