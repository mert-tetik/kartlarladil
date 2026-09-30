import { VOCABULARY_CARDS } from "@/data/cards";
import {
  CARD_GROUPS,
  getCardGroupForCard,
  getCardsForGroup,
  type CardGroupDefinition,
} from "@/features/cards/card-groups";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import type { LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";

export const LANDING_GROUP_QUESTION_CHANCE = 0.4;
export const LANDING_GROUP_QUESTION_OPTION_COUNT = 6;

export interface LandingGroupQuestionOption {
  card: VocabularyCard;
  group: CardGroupDefinition;
  isCorrect: boolean;
}

export interface LandingGroupQuestion {
  prompt: string;
  options: readonly LandingGroupQuestionOption[];
  correctOptionId: string;
  sourceCardId: string;
}

type Random = () => number;

export function createLandingGroupQuestion(
  language: LanguageCode,
  uiLocale: LocaleCode,
  random: Random = Math.random,
): LandingGroupQuestion | null {
  const groupedCards = VOCABULARY_CARDS.filter(
    (card) => card.language === language && getCardGroupForCard(card),
  );

  if (groupedCards.length === 0 || random() >= LANDING_GROUP_QUESTION_CHANCE) {
    return null;
  }

  const sourceCard = groupedCards[Math.min(groupedCards.length - 1, Math.floor(random() * groupedCards.length))];
  return buildLandingGroupQuestion(sourceCard, uiLocale, random);
}

export function buildLandingGroupQuestion(
  sourceCard: VocabularyCard,
  uiLocale: LocaleCode,
  random: Random = Math.random,
): LandingGroupQuestion | null {
  const sourceGroup = getCardGroupForCard(sourceCard);
  if (!sourceGroup) return null;

  const availableGroups = CARD_GROUPS.filter(
    (group) => group.id !== sourceGroup.id && getCardsForGroup(group.id, sourceCard.language).length > 0,
  );
  if (availableGroups.length < LANDING_GROUP_QUESTION_OPTION_COUNT - 1) return null;

  const impostorGroups = takeRandomDistinct(availableGroups, LANDING_GROUP_QUESTION_OPTION_COUNT - 1, random);
  const options = [
    {
      card: sourceCard,
      group: sourceGroup,
      isCorrect: true,
    },
    ...impostorGroups.map((group) => ({
      card: getCardsForGroup(group.id, sourceCard.language)[0],
      group,
      isCorrect: false,
    })),
  ];

  return {
    prompt: getPrimaryCardTranslation(sourceCard, uiLocale),
    options: shuffle(options, random),
    correctOptionId: sourceCard.id,
    sourceCardId: sourceCard.id,
  };
}

function takeRandomDistinct<T>(items: readonly T[], count: number, random: Random): T[] {
  const pool = [...items];
  const selected: T[] = [];

  while (selected.length < count && pool.length > 0) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  return takeRandomDistinct(items, items.length, random);
}
