import { VOCABULARY_CARDS } from "@/data/cards";
import { getSearchableCardText } from "@/features/cards/card-localization";
import type { CardFilters, CardRepository, VocabularyCard } from "@/types/domain";
import { normalizeSearch } from "@/lib/utils";

function matchesFilters(card: VocabularyCard, filters: CardFilters = {}) {
  const languageMatches = !filters.language || filters.language === "all" || card.language === filters.language;
  const tierMatches = !filters.tier || filters.tier === "all" || card.tier === filters.tier;
  const query = normalizeSearch(filters.query ?? "");

  if (!languageMatches || !tierMatches) {
    return false;
  }

  if (!query) {
    return true;
  }

  const searchableText = normalizeSearch(getSearchableCardText(card));

  return searchableText.includes(query);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export const localCardRepository: CardRepository = {
  list(filters) {
    return VOCABULARY_CARDS.filter((card) => matchesFilters(card, filters));
  },

  findById(cardId) {
    return VOCABULARY_CARDS.find((card) => card.id === cardId);
  },

  draw(count, filters, excludedIds = []) {
    const excluded = new Set(excludedIds);
    const candidates = VOCABULARY_CARDS.filter(
      (card) => matchesFilters(card, filters) && !excluded.has(card.id),
    );

    return shuffle(candidates).slice(0, count);
  },
};
