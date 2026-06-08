import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

export function CardGrid({
  cards,
  inventoryByCardId,
}: {
  cards: VocabularyCard[];
  inventoryByCardId?: Map<string, InventoryCard>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <VocabularyCardView key={card.id} card={card} inventory={inventoryByCardId?.get(card.id)} />
      ))}
    </div>
  );
}

export function InventoryCardGrid({ cards }: { cards: InventoryCardView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map(({ card, inventory }) => (
        <VocabularyCardView key={card.id} card={card} inventory={inventory} />
      ))}
    </div>
  );
}
