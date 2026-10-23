import { LANGUAGE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode, Tier, VocabularyCard } from "@/types/domain";

export type CardDesignTestCardSource = Pick<
  VocabularyCard,
  "id" | "language" | "tier" | "termKind" | "term" | "partOfSpeech" | "pronunciation" | "example"
> & {
  translations: Partial<Record<LocaleCode, string>>;
  translationMeaningsByLocale: Partial<Record<LocaleCode, string[]>>;
};

export interface CardDesignTestSample {
  cardId: string;
  learningLanguage: LanguageCode;
  nativeLanguage: LocaleCode;
  tier: Tier;
  term: string;
  translation: string;
  partOfSpeech: string;
  pronunciation: string;
  example: string;
}

export interface CardDesignTestSampleExclusions {
  cardId?: string;
  learningLanguage?: LanguageCode;
  nativeLanguage?: LocaleCode;
}

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(Math.max(0, random()) * items.length));
  return items[index];
}

export function createRandomCardDesignTestSample(
  cards: readonly CardDesignTestCardSource[],
  exclusions: CardDesignTestSampleExclusions = {},
  random: () => number = Math.random,
): CardDesignTestSample {
  const words = cards.filter((card) => card.termKind === "word");
  if (words.length === 0) {
    throw new Error("The vocabulary catalog does not contain any word cards.");
  }

  let bestScore = -1;
  const bestChoices: Array<{ card: CardDesignTestCardSource; nativeLanguage: LocaleCode }> = [];

  for (const card of words) {
    const nativeLanguages = LANGUAGE_CODES.filter((language) =>
      language !== card.language
      && Boolean(
        card.translationMeaningsByLocale[language]?.[0]?.trim()
        || card.translations[language]?.trim(),
      ),
    );

    for (const nativeLanguage of nativeLanguages) {
      const score = Number(card.id !== exclusions.cardId)
        + Number(card.language !== exclusions.learningLanguage)
        + Number(nativeLanguage !== exclusions.nativeLanguage);

      if (score > bestScore) {
        bestScore = score;
        bestChoices.length = 0;
      }
      if (score === bestScore) bestChoices.push({ card, nativeLanguage });
    }
  }

  if (bestChoices.length === 0) {
    throw new Error("No native-language translation is available for any vocabulary card.");
  }

  // Prefer changing the card and both languages, but fall back gracefully when
  // a word only has translations for a limited set of native languages.
  const { card, nativeLanguage } = pickRandom(bestChoices, random);
  const translation = card.translationMeaningsByLocale[nativeLanguage]?.[0]?.trim()
    || card.translations[nativeLanguage]?.trim()
    || "";

  return {
    cardId: card.id,
    learningLanguage: card.language,
    nativeLanguage,
    tier: card.tier,
    term: card.term,
    translation,
    partOfSpeech: card.partOfSpeech,
    pronunciation: card.pronunciation,
    example: card.example,
  };
}
