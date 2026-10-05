import type { TranslationKey } from "@/i18n/dictionaries";

export type QuizContinuationMotivationId =
  | "nearLearned"
  | "nearLevelUp"
  | "nextRank"
  | "missedChest"
  | "accuracy"
  | "mistakes"
  | "remainingCards"
  | "xp"
  | "gems"
  | "leaderboard"
  | "medals"
  | "drawCards";

export type QuizContinuationMotivation = {
  id: QuizContinuationMotivationId;
  strength: number;
  headerKey: TranslationKey;
  messageKey: TranslationKey;
  values: Record<string, string | number>;
};

export type QuizContinuationMotivationInput = {
  nearLearnedCount: number;
  nearLevelUpCount: number;
  rankProgressPercent: number;
  pointsToNextRank: number;
  accuracy: number;
  incorrectCount: number;
  answeredCount: number;
  remainingActiveCards: number;
  gainedXp: number;
  gainedGems: number;
  earnedMedals: number;
  chestWasMissed: boolean;
  chestMissedByPercentagePoints: number;
};

export type QuizContinuationMotivationOptions = {
  isReviewQuiz?: boolean;
  prioritizeNextRank?: boolean;
};

const MOTIVATION_MESSAGE_KEYS = {
  nearLearned: "quiz.continuation.motivation.nearLearned",
  nearLevelUp: "quiz.continuation.motivation.nearLevelUp",
  nextRank: "quiz.continuation.motivation.nextRank",
  missedChest: "quiz.continuation.motivation.missedChest",
  accuracy: "quiz.continuation.motivation.accuracy",
  mistakes: "quiz.continuation.motivation.mistakes",
  remainingCards: "quiz.continuation.motivation.remainingCards",
  xp: "quiz.continuation.motivation.xp",
  gems: "quiz.continuation.motivation.gems",
  leaderboard: "quiz.continuation.motivation.leaderboard",
  medals: "quiz.continuation.motivation.medals",
  drawCards: "quiz.continuation.motivation.drawCards",
} as const satisfies Record<QuizContinuationMotivationId, TranslationKey>;

const MOTIVATION_HEADER_KEYS = {
  nearLearned: "quiz.continuation.header.nearLearned",
  nearLevelUp: "quiz.continuation.header.nearLevelUp",
  nextRank: "quiz.continuation.header.nextRank",
  missedChest: "quiz.continuation.header.missedChest",
  accuracy: "quiz.continuation.header.accuracy",
  mistakes: "quiz.continuation.header.mistakes",
  remainingCards: "quiz.continuation.header.remainingCards",
  xp: "quiz.continuation.header.xp",
  gems: "quiz.continuation.header.gems",
  leaderboard: "quiz.continuation.header.leaderboard",
  medals: "quiz.continuation.header.medals",
  drawCards: "quiz.continuation.header.drawCards",
} as const satisfies Record<QuizContinuationMotivationId, TranslationKey>;

const REVIEW_MOTIVATIONS = [
  {
    id: "nearLearned" as const,
    strength: 0.94,
    headerKey: "quiz.continuation.review.header.memory" as TranslationKey,
    messageKey: "quiz.continuation.review.motivation.memory" as TranslationKey,
  },
  {
    id: "accuracy" as const,
    strength: 0.88,
    headerKey: "quiz.continuation.review.header.recall" as TranslationKey,
    messageKey: "quiz.continuation.review.motivation.recall" as TranslationKey,
  },
  {
    id: "mistakes" as const,
    strength: 0.82,
    headerKey: "quiz.continuation.review.header.tricky" as TranslationKey,
    messageKey: "quiz.continuation.review.motivation.tricky" as TranslationKey,
  },
] as const;

const NEXT_RANK_MAX_POINTS_FOR_GUARANTEED_MOTIVATION = 370;
const NEXT_RANK_MIN_PROGRESS_FOR_GUARANTEED_MOTIVATION = 75;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function progressStrength(count: number) {
  return count > 0 ? clamp(0.42 + count * 0.18) : 0;
}

function nextRankStrength(pointsToNextRank: number) {
  if (pointsToNextRank <= 0) return 0;

  // A smaller point gap should feel more urgent while very distant ranks
  // remain possible but less prominent in the three-card selection.
  return clamp(0.99 - Math.log10(pointsToNextRank + 1) * 0.17, 0.22, 0.95);
}

function shouldShowNextRankMotivation(
  input: QuizContinuationMotivationInput,
  options: QuizContinuationMotivationOptions,
) {
  if (input.pointsToNextRank <= 0) return false;
  if (options.prioritizeNextRank) return true;

  return input.pointsToNextRank < NEXT_RANK_MAX_POINTS_FOR_GUARANTEED_MOTIVATION
    || input.rankProgressPercent >= NEXT_RANK_MIN_PROGRESS_FOR_GUARANTEED_MOTIVATION;
}

function medalsStrength(earnedMedals: number) {
  const normalizedMedals = clamp(Math.round(earnedMedals), 0, 5);
  return clamp(0.18 + (5 - normalizedMedals) * 0.14, 0.18, 0.88);
}

function shuffled<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

/**
 * Selects the three most useful reasons to continue. The random pre-sort is
 * intentional: Array#sort is stable, so equal strengths are then resolved by
 * the randomized order while stronger motivations always remain ahead.
 */
export function selectQuizContinuationMotivations(
  input: QuizContinuationMotivationInput,
  options: QuizContinuationMotivationOptions = {},
): QuizContinuationMotivation[] {
  if (options.isReviewQuiz) {
    return REVIEW_MOTIVATIONS.map((motivation) => ({
      ...motivation,
      values: {},
    }));
  }

  const shouldIncludeNextRank = shouldShowNextRankMotivation(input, options);

  const candidates: QuizContinuationMotivation[] = [
    {
      id: "nearLearned",
      strength: progressStrength(input.nearLearnedCount),
      headerKey: MOTIVATION_HEADER_KEYS.nearLearned,
      messageKey: MOTIVATION_MESSAGE_KEYS.nearLearned,
      values: { count: input.nearLearnedCount },
    },
    {
      id: "nearLevelUp",
      strength: progressStrength(input.nearLevelUpCount),
      headerKey: MOTIVATION_HEADER_KEYS.nearLevelUp,
      messageKey: MOTIVATION_MESSAGE_KEYS.nearLevelUp,
      values: { count: input.nearLevelUpCount },
    },
    {
      id: "nextRank",
      strength: shouldIncludeNextRank ? nextRankStrength(input.pointsToNextRank) : 0,
      headerKey: MOTIVATION_HEADER_KEYS.nextRank,
      messageKey: MOTIVATION_MESSAGE_KEYS.nextRank,
      values: { points: Math.max(0, Math.round(input.pointsToNextRank)) },
    },
    {
      id: "missedChest",
      strength: input.chestWasMissed
        ? clamp(0.84 + (1 - clamp(input.chestMissedByPercentagePoints / 70)) * 0.14)
        : 0,
      headerKey: MOTIVATION_HEADER_KEYS.missedChest,
      messageKey: MOTIVATION_MESSAGE_KEYS.missedChest,
      values: { missedBy: Math.max(0, Math.round(input.chestMissedByPercentagePoints)) },
    },
    {
      id: "accuracy",
      strength: input.answeredCount > 0
        ? clamp(0.12 + (100 - clamp(input.accuracy, 0, 100)) / 100 * 0.62)
        : 0,
      headerKey: MOTIVATION_HEADER_KEYS.accuracy,
      messageKey: MOTIVATION_MESSAGE_KEYS.accuracy,
      values: { accuracy: Math.round(input.accuracy) },
    },
    {
      id: "mistakes",
      strength: input.incorrectCount > 0
        ? clamp(0.25 + input.incorrectCount / Math.max(1, input.answeredCount) * 0.55)
        : 0,
      headerKey: MOTIVATION_HEADER_KEYS.mistakes,
      messageKey: MOTIVATION_MESSAGE_KEYS.mistakes,
      values: { count: input.incorrectCount },
    },
    {
      id: "remainingCards",
      strength: input.remainingActiveCards > 0
        ? clamp(0.2 + input.remainingActiveCards / 15 * 0.55)
        : 0,
      headerKey: MOTIVATION_HEADER_KEYS.remainingCards,
      messageKey: MOTIVATION_MESSAGE_KEYS.remainingCards,
      values: { count: input.remainingActiveCards },
    },
    {
      id: "xp",
      strength: input.gainedXp > 0 ? 0.34 : 0,
      headerKey: MOTIVATION_HEADER_KEYS.xp,
      messageKey: MOTIVATION_MESSAGE_KEYS.xp,
      values: { xp: Math.round(input.gainedXp) },
    },
    {
      id: "gems",
      strength: input.gainedGems > 0 ? 0.36 : 0,
      headerKey: MOTIVATION_HEADER_KEYS.gems,
      messageKey: MOTIVATION_MESSAGE_KEYS.gems,
      values: { gems: Math.round(input.gainedGems) },
    },
    {
      id: "leaderboard",
      strength: 0.34,
      headerKey: MOTIVATION_HEADER_KEYS.leaderboard,
      messageKey: MOTIVATION_MESSAGE_KEYS.leaderboard,
      values: {},
    },
    {
      id: "medals",
      strength: medalsStrength(input.earnedMedals),
      headerKey: MOTIVATION_HEADER_KEYS.medals,
      messageKey: MOTIVATION_MESSAGE_KEYS.medals,
      values: {},
    },
    {
      id: "drawCards",
      strength: input.remainingActiveCards === 0 ? 1 : 0,
      headerKey: MOTIVATION_HEADER_KEYS.drawCards,
      messageKey: MOTIVATION_MESSAGE_KEYS.drawCards,
      values: {},
    },
  ];

  const ensureNextRank = (selected: QuizContinuationMotivation[]) => {
    if (!shouldIncludeNextRank) return selected;

    const nextRank = candidates.find((candidate) => candidate.id === "nextRank");
    if (!nextRank || nextRank.strength <= 0) return selected;

    if (options.prioritizeNextRank) {
      return [nextRank, ...selected.filter((candidate) => candidate.id !== "nextRank")].slice(0, 3);
    }

    if (selected.some((candidate) => candidate.id === "nextRank")) return selected;

    const leaderboard = selected.find((candidate) => candidate.id === "leaderboard");
    const withoutLeaderboard = selected.filter((candidate) => candidate.id !== "leaderboard");
    return [
      ...withoutLeaderboard.slice(0, 1),
      nextRank,
      ...(leaderboard ? [leaderboard] : []),
    ].slice(0, 3);
  };

  if (input.remainingActiveCards === 0) {
    const drawCards = candidates.find((candidate) => candidate.id === "drawCards")!;
    const remaining = shuffled(
      candidates.filter(
        (candidate) => candidate.id !== "drawCards" && candidate.id !== "leaderboard",
      ),
    ).sort((left, right) => right.strength - left.strength);
    const leaderboard = candidates.find((candidate) => candidate.id === "leaderboard")!;
    return ensureNextRank(
      [drawCards, ...remaining.slice(0, 1), leaderboard]
        .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
        .slice(0, 3),
    );
  }

  const eligible = candidates.filter((candidate) => candidate.strength > 0);
  const fallback = candidates.filter(
    (candidate) => candidate.strength === 0 && candidate.id !== "nextRank",
  );
  const ordered = [...shuffled(eligible), ...shuffled(fallback)]
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 3);
  const leaderboard = candidates.find((candidate) => candidate.id === "leaderboard")!;
  return ensureNextRank([
    ...ordered.filter((candidate) => candidate.id !== "leaderboard").slice(0, 2),
    leaderboard,
  ]);
}
