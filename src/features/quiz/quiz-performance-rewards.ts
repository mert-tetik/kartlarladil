import { getRankForPoints } from "@/features/progress/progress-stats";
import type { RankDefinition } from "@/types/domain";

export interface QuizPerformanceRewardInput {
  selectedCount: number;
  durationSeconds: number;
  correctAnswerCount: number;
  answeredCount: number;
  correctCardCount: number;
  learnedCardCount: number;
}

export interface QuizPerformanceRewardBreakdown {
  accuracyPoints: number;
  timePoints: number;
  correctPoints: number;
  learnedPoints: number;
  totalPoints: number;
}

export interface QuizPerformanceRankUp {
  fromRank: RankDefinition;
  rank: RankDefinition;
}

export const QUIZ_PERFORMANCE_REWARD_CONTINUE_FAILSAFE_MS = 5200;

export function isQuizPerformanceContinueLocked({
  hasRewardSequence,
  animationsComplete,
  rankCheckComplete,
  rankUp,
  rankOverlayPresented,
  failsafeElapsed,
}: {
  hasRewardSequence: boolean;
  animationsComplete: boolean;
  rankCheckComplete: boolean;
  rankUp: QuizPerformanceRankUp | null;
  rankOverlayPresented: boolean;
  failsafeElapsed: boolean;
}) {
  if (!hasRewardSequence || failsafeElapsed) return false;
  return !animationsComplete || !rankCheckComplete || Boolean(rankUp && !rankOverlayPresented);
}

export function getQuizPerformanceRankUp(
  currentTotalPoints: number,
  awardedPoints: number,
): QuizPerformanceRankUp | null {
  if (!Number.isFinite(currentTotalPoints) || !Number.isFinite(awardedPoints)) {
    return null;
  }

  const pointsBeforeAward = Math.max(0, Math.floor(currentTotalPoints));
  const previousRank = getRankForPoints(pointsBeforeAward);
  const nextRank = getRankForPoints(
    pointsBeforeAward + Math.max(0, Math.floor(awardedPoints)),
  );

  return nextRank.minPoints > previousRank.minPoints
    ? { fromRank: previousRank, rank: nextRank }
    : null;
}

const MAX_QUIZ_DURATION_SECONDS = 12 * 60 * 60;

/**
 * Gives each result category a bounded 0–50 reward. Time is normalized to the
 * selected quiz size: finishing in one minute per card earns zero time points;
 * finishing instantly earns the full 50.
 */
export function getQuizPerformanceRewardBreakdown(
  input: QuizPerformanceRewardInput,
): QuizPerformanceRewardBreakdown | null {
  const {
    selectedCount,
    durationSeconds,
    correctAnswerCount,
    answeredCount,
    correctCardCount,
    learnedCardCount,
  } = input;

  if (
    !Number.isInteger(selectedCount) ||
    selectedCount < 1 ||
    selectedCount > 50 ||
    !Number.isFinite(durationSeconds) ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 0 ||
    durationSeconds > MAX_QUIZ_DURATION_SECONDS ||
    !Number.isInteger(correctAnswerCount) ||
    !Number.isInteger(answeredCount) ||
    correctAnswerCount < 0 ||
    answeredCount < 0 ||
    correctAnswerCount > answeredCount ||
    answeredCount > selectedCount * 20 ||
    !Number.isInteger(correctCardCount) ||
    correctCardCount < 0 ||
    correctCardCount > selectedCount ||
    !Number.isInteger(learnedCardCount) ||
    learnedCardCount < 0 ||
    learnedCardCount > selectedCount
  ) {
    return null;
  }

  const accuracyPoints = answeredCount === 0
    ? 0
    : Math.round((correctAnswerCount / answeredCount) * 50);
  const timePoints = Math.round(
    50 * Math.max(0, 1 - durationSeconds / (selectedCount * 60)),
  );
  const correctPoints = Math.min(50, correctCardCount * 10);
  const learnedPoints = Math.min(50, learnedCardCount * 20);

  return {
    accuracyPoints,
    timePoints,
    correctPoints,
    learnedPoints,
    totalPoints: accuracyPoints + timePoints + correctPoints + learnedPoints,
  };
}
