import { normalizeSearch } from "@/lib/utils";
import type { CreateCardDirection } from "@/features/cards/create-card-schema";
import {
  normalizeTransliterationMatchKey,
  requiresNativeWritingSystem,
} from "@/features/cards/create-card-language";
import type { LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";

interface FindCustomCardMatchInput {
  cards: VocabularyCard[];
  term: string;
  inputLanguage: LocaleCode;
  targetLanguage: LanguageCode;
  direction: CreateCardDirection;
}

export function findCustomCardMatch({
  cards,
  term,
  inputLanguage,
  targetLanguage,
  direction,
}: FindCustomCardMatchInput): VocabularyCard | undefined {
  const normalizedTerm = normalizeSearch(term);

  if (!normalizedTerm) {
    return undefined;
  }

  return cards.find((card) => {
    if (card.language !== targetLanguage) {
      return false;
    }

    if (direction === "learning-to-native") {
      if (normalizeSearch(card.term) === normalizedTerm) {
        return true;
      }

      return requiresNativeWritingSystem(targetLanguage)
        && normalizeTransliterationMatchKey(card.pronunciation) === normalizeTransliterationMatchKey(term);
    }

    const directTranslation = card.translations[inputLanguage];
    const translationMeanings = card.translationMeaningsByLocale[inputLanguage] ?? [];

    return [directTranslation, ...translationMeanings].some(
      (translation) => normalizeSearch(translation) === normalizedTerm,
    );
  });
}
