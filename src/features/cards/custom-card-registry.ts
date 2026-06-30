import { VOCABULARY_CARDS } from "@/data/cards";
import type { VocabularyCard } from "@/types/domain";

class CustomCardRegistry {
  private customCards = new Map<string, VocabularyCard>();

  register(card: VocabularyCard) {
    this.customCards.set(card.sourceKey, card);
  }

  unregister(sourceKey: string) {
    this.customCards.delete(sourceKey);
  }

  clear() {
    this.customCards.clear();
  }

  findById(cardId: string): VocabularyCard | undefined {
    for (const card of this.customCards.values()) {
      if (card.id === cardId) {
        return card;
      }
    }
    return undefined;
  }

  findBySourceKey(sourceKey: string): VocabularyCard | undefined {
    return this.customCards.get(sourceKey);
  }

  list(): VocabularyCard[] {
    return Array.from(this.customCards.values());
  }

  getAllCards(): VocabularyCard[] {
    const customBySourceKey = new Map(this.list().map((card) => [card.sourceKey, card]));

    return [
      ...VOCABULARY_CARDS.filter((card) => !customBySourceKey.has(card.sourceKey)),
      ...this.list(),
    ];
  }
}

export const customCardRegistry = new CustomCardRegistry();
