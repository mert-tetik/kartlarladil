import { createCardSourceKey } from "@/data/cards";
import { CARD_DEFINITIONS } from "@/data/card-definitions.generated";
import type { LocaleCode, VocabularyCard } from "@/types/domain";

export type CardDefinitionMap = Record<string, Partial<Record<LocaleCode, string>>>;
type CardDefinitionCard = Pick<VocabularyCard, "tier" | "termKind" | "englishKey" | "partOfSpeech">
  & Partial<Pick<VocabularyCard, "definitionsByLocale">>;

export function getCardDefinitionKey(card: Pick<VocabularyCard, "tier" | "termKind" | "englishKey" | "partOfSpeech">) {
  return createCardSourceKey("en", card.tier, card.englishKey, card.partOfSpeech, card.termKind);
}

export function getCardDefinition(
  card: CardDefinitionCard,
  locale: LocaleCode,
  definitions: CardDefinitionMap = CARD_DEFINITIONS as CardDefinitionMap,
) {
  const definition = card.definitionsByLocale?.[locale] ?? definitions[getCardDefinitionKey(card)]?.[locale];
  const normalized = typeof definition === "string" ? definition.trim() : "";

  return normalized || null;
}
