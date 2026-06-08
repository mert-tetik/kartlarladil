import { VOCABULARY_CARDS } from "@/data/cards";
import type { CardStatus, InventoryCard, LanguageCode, VocabularyCard } from "@/types/domain";

export interface InventoryCardView {
  inventory: InventoryCard;
  card: VocabularyCard;
}

export function joinInventoryCards(cards: InventoryCard[]): InventoryCardView[] {
  const cardById = new Map(VOCABULARY_CARDS.map((card) => [card.id, card]));

  return cards.flatMap((inventory) => {
    const card = cardById.get(inventory.cardId);
    return card ? [{ inventory, card }] : [];
  });
}

export function filterInventoryCards(input: {
  cards: InventoryCard[];
  language?: LanguageCode | "all";
  status?: CardStatus | "all";
}) {
  return joinInventoryCards(input.cards).filter(({ inventory, card }) => {
    const languageMatches = !input.language || input.language === "all" || card.language === input.language;
    const statusMatches = !input.status || input.status === "all" || inventory.status === input.status;

    return languageMatches && statusMatches;
  });
}
