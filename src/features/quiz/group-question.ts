import { VOCABULARY_CARDS } from "@/data/cards";
import {
  CARD_GROUPS,
  getCardGroupForCard,
  getCardsForGroup,
  type CardGroupIcon,
  type CardGroupDefinition,
} from "@/features/cards/card-groups";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

export const GROUP_QUESTION_CHANCE = 0.3;
export const GROUP_QUESTION_OPTION_COUNT = 6;
export const GROUP_QUESTION_EXCLUDED_GROUPS = new Set<CardGroupIcon>([
  "commonVerbs",
  "advancedVerbs",
]);

export interface GroupQuestionOption {
  card: VocabularyCard;
  group: CardGroupDefinition;
  isCorrect: boolean;
}

export interface GroupQuestion {
  options: readonly GroupQuestionOption[];
  correctOptionId: string;
  sourceCardId: string;
}

type Random = () => number;

export function shouldUseGroupQuestion(random: Random = Math.random) {
  return random() < GROUP_QUESTION_CHANCE;
}

export function buildGroupQuestion(
  sourceCard: VocabularyCard,
  random: Random = Math.random,
): GroupQuestion | null {
  const sourceGroup = getCardGroupForCard(sourceCard);
  if (!sourceGroup || GROUP_QUESTION_EXCLUDED_GROUPS.has(sourceGroup.id)) return null;

  const availableGroups = CARD_GROUPS.filter(
    (group) =>
      group.id !== sourceGroup.id &&
      !GROUP_QUESTION_EXCLUDED_GROUPS.has(group.id) &&
      getCardsForGroup(group.id, sourceCard.language).length > 0,
  );
  if (availableGroups.length < GROUP_QUESTION_OPTION_COUNT - 1) return null;

  const impostorGroups = takeRandomDistinct(availableGroups, GROUP_QUESTION_OPTION_COUNT - 1, random);
  const impostorOptions = impostorGroups.flatMap((group) => {
    // Every imposter group contributes exactly one target-language card.
    // The group image identifies the group; the card term is the answer.
    const representativeCard = getCardsForGroup(group.id, sourceCard.language)[0];
    return representativeCard
      ? [{ card: representativeCard, group, isCorrect: false }]
      : [];
  });

  if (impostorOptions.length !== GROUP_QUESTION_OPTION_COUNT - 1) return null;

  const options = [
    {
      card: sourceCard,
      group: sourceGroup,
      isCorrect: true,
    },
    ...impostorOptions,
  ];

  return {
    options: shuffle(options, random),
    correctOptionId: sourceCard.id,
    sourceCardId: sourceCard.id,
  };
}

export function createGroupQuestion(
  language: LanguageCode,
  random: Random = Math.random,
): GroupQuestion | null {
  const groupedCards = VOCABULARY_CARDS.filter(
    (card) => {
      const group = getCardGroupForCard(card);
      return card.language === language && group && !GROUP_QUESTION_EXCLUDED_GROUPS.has(group.id);
    },
  );

  if (groupedCards.length === 0 || !shouldUseGroupQuestion(random)) {
    return null;
  }

  const sourceCard = groupedCards[Math.min(groupedCards.length - 1, Math.floor(random() * groupedCards.length))];
  return sourceCard ? buildGroupQuestion(sourceCard, random) : null;
}

function takeRandomDistinct<T>(items: readonly T[], count: number, random: Random): T[] {
  const pool = [...items];
  const selected: T[] = [];

  while (selected.length < count && pool.length > 0) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    const item = pool.splice(index, 1)[0];
    if (item) selected.push(item);
  }

  return selected;
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  return takeRandomDistinct(items, items.length, random);
}
