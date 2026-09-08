import { VOCABULARY_CARDS } from "@/data/cards";
import type { DeveloperCatalogCardMatch } from "@/features/developer/developer-types";

const MAX_CATALOG_MATCHES = 12;

export function findDeveloperCatalogCards(
  query: string,
): DeveloperCatalogCardMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length < 2) return [];

  return VOCABULARY_CARDS.filter((card) =>
    [card.term, card.translation, card.englishKey, card.sourceKey].some(
      (value) => value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  )
    .slice(0, MAX_CATALOG_MATCHES)
    .map((card) => ({
      sourceKey: card.sourceKey,
      term: card.term,
      translation: card.translation,
      language: card.language,
      tier: card.tier,
    }));
}
