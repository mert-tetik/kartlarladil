import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import type { InventoryCard, LanguageCode, LocaleCode, Tier, TermKind, VocabularyCard } from "@/types/domain";

export interface OfflineVocabularyCard {
  id: string;
  sourceKey: string;
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  term: string;
  translation: string;
  translations: Partial<Record<LocaleCode, string>>;
  pronunciation: string;
  partOfSpeech: string;
  example: string;
}

export interface OfflineInventoryEntry {
  inventory: InventoryCard;
  card: OfflineVocabularyCard;
}

export function createOfflineInventorySnapshot(input: {
  inventory: InventoryCard[];
  nativeLanguage: LocaleCode;
}): { cards: OfflineInventoryEntry[]; complete: boolean } {
  const resolved = joinInventoryCards(input.inventory);
  const cards = resolved.flatMap(({ inventory, card }) => {
    const nativeTranslation = getTranslation(card, input.nativeLanguage);
    const englishTranslation = getTranslation(card, "en");
    const translations: Partial<Record<LocaleCode, string>> = {};
    if (nativeTranslation) translations[input.nativeLanguage] = nativeTranslation;
    if (englishTranslation) translations.en = englishTranslation;

    return [{
      inventory,
      card: {
        id: card.id,
        sourceKey: card.sourceKey,
        language: card.language,
        tier: card.tier,
        termKind: card.termKind,
        term: card.term,
        translation: nativeTranslation || englishTranslation || card.translation,
        translations,
        pronunciation: card.pronunciation,
        partOfSpeech: card.partOfSpeech,
        example: card.examples.find((example) => example.sentence.trim())?.sentence ?? card.example,
      },
    }];
  });

  return { cards, complete: resolved.length === input.inventory.length };
}

function getTranslation(card: VocabularyCard, locale: LocaleCode) {
  const value = card.translations[locale];
  return typeof value === "string" ? value.trim() : "";
}
