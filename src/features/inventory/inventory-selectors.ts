import { customCardRegistry } from "@/features/cards/custom-card-registry";
import type { CardStatus, InventoryCard, LanguageCode, VocabularyCard } from "@/types/domain";

export interface InventoryCardView {
  inventory: InventoryCard;
  card: VocabularyCard;
}

export function joinInventoryCards(cards: InventoryCard[]): InventoryCardView[] {
  const cardById = new Map(
    customCardRegistry
      .getAllCards()
      .flatMap((card) => [
        [card.id, card],
        [card.sourceKey, card],
      ]),
  );

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
