"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Loader2,
  Medal,
  RefreshCw,
  Star,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LANGUAGES } from "@/data/languages";
import { TIER_STYLES } from "@/data/tiers";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useCardPronunciation } from "@/features/cards/card-pronunciation-client";
import {
  getCardTranslation,
  getCardTranslationMeanings,
  getStudyLocale,
} from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { getAiPracticeCharacters, getCharacterName } from "@/features/ai-practice/ai-practice-data";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import {
  buildQuizQuestion,
  buildListeningQuizQuestion,
  buildDefinitionQuizQuestion,
  buildSentenceCompletionQuizQuestion,
  buildTrueFalseQuizQuestion,
  getTierRequirement,
  isAnswerSimilarEnough,
  shouldUseSentenceCompletionQuestion,
  shouldUseListeningQuestion,
  shouldUseDefinitionQuestion,
  shouldUseTrueFalseQuestion,
} from "@/features/quiz/quiz-engine";
import {
  buildCategoryBonusFromGenerated,
  buildFallbackCategoryBonusQuestion,
  buildFallbackSentenceOrderQuestion,
  buildImposterBonusQuestion,
  buildMatchingBonusQuestion,
  buildSentenceBonusFromGenerated,
  getBonusCopy,
  type BonusQuestion,
  type BonusQuestionKind,
} from "@/features/quiz/bonus-questions";
import {
  requestCategoryBonusQuestion,
  requestSentenceBonusQuestion,
} from "@/features/quiz/bonus-question-client";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import {
  useAuthSession,
  useOptionalAuthSession,
  useRequireAuthAction,
} from "@/features/auth/auth-client";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { useProgressStats } from "@/features/progress/progress-client";
import { RankUpMenu } from "@/features/progress/components/rank-progress-popover";
import { acknowledgeRankUp, setQuizRankUpDeferred } from "@/features/progress/rank-up-flow";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { getQuizResultRewardPoints } from "@/features/quiz/result-rewards";
import { aiValidateTextAnswer } from "@/features/quiz/ai-validate-answer";
import {
  awardChestPoints,
  awardQuizBonusPoints,
  awardQuizResultPoints,
  awardQuizStreakPoints,
} from "@/features/quiz/actions";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { markPlayReviewEligible } from "@/features/reviews/play-review-eligibility";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import type { ChestRewardOutcome, GemBalances, GemRewards } from "@/features/gems/gem-types";
import { awardProgressGemRewardAction, spendGemAction } from "@/features/gems/gem-actions";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";
import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { QuizStartSplash } from "@/features/quiz/components/quiz-start-splash";
import {
  BonusQuestionIntro,
  BonusQuestionView,
} from "@/features/quiz/components/bonus-question-view";
import { QuizStreakCelebrationView } from "@/features/quiz/components/quiz-streak-celebration-view";
import { QuizStreakRewardView } from "@/features/quiz/components/quiz-streak-reward-view";
import { QuizStarRating } from "@/features/quiz/components/quiz-star-rating";
import {
  getChestTierByCount,
  resolveAwardedChestTier,
  QUIZ_COUNT_OPTIONS,
  getChestPreviewPairForCount,
  getChestLabelKey,
  getChestRewardPoints,
  type ChestTier,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import { getQuizStreakRewardPoints, getRewardableQuizStreak } from "@/features/quiz/streak-rewards";
import { EmptyState } from "@/components/empty-state";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import { LanguageFlag } from "@/components/language-flag";
import { ScoreIcon } from "@/components/score-icon";
import { Badge } from "@/components/ui/badge";
import { RankIcon } from "@/features/progress/rank-icons";
import { Button, buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSkipButton } from "@/features/quiz/components/quiz-skip-button";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { GEM_ASSETS, GEM_COSTS } from "@/features/gems/gem-types";

import {
  formatCards,
  formatNumber,
  formatPoints,
  getLanguageDisplayName,
  getRankLabel,
} from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import confetti from "canvas-confetti";
import type {
  DefinitionQuizQuestion,
  InventoryCard,
  ListeningQuizQuestion,
  LanguageCode,
  LimitErrorCode,
  LocaleCode,
  PracticeMode,
  QuizQuestion,
  SentenceCompletionQuizQuestion,
  TrueFalseQuizQuestion,
  AiPracticeCharacter,
  RankDefinition,
  VocabularyCard,
} from "@/types/domain";

type QuizPhase =
  | "language"
  | "count"
  | "quiz-start"
  | "bonus-intro"
  | "quiz"
  | "streak-celebration"
  | "streak-reward"
  | "celebration"
  | "result-pending"
  | "rank-up"
  | "result"
  | "chest-celebration"
  | "chest";

export type { QuizPhase };

type AdvanceQuizOptions = {
  bypassCelebration?: boolean;
  resultsOverride?: QuizResult;
  skipRankUpCheck?: boolean;
};

const MODE_STYLE = {
  active: {
    bg: "bg-action-learn",
    border: "border-[var(--action-learn)]",
    hover: "hover:bg-action-learn-hover",
  },
  learned: {
    bg: "bg-action-learned",
    border: "border-[var(--action-learned)]",
    hover: "hover:bg-action-review-hover",
  },
} as const;

const QUIZ_COUNT_BUTTON_COLORS = [
  "bg-yellow-400",
  "bg-red-500",
  "bg-green-500",
  "bg-blue-500",
] as const;

function getQuizCountButtonColor(count: number) {
  const index = QUIZ_COUNT_OPTIONS.findIndex((option) => option === count);
  return QUIZ_COUNT_BUTTON_COLORS[index >= 0 ? index : 0];
}

const CHOICE_OPTION_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-amber-400",
  "bg-emerald-500",
] as const;

const SENTENCE_COMPLETION_OPTION_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-pink-500",
] as const;

const RESULT_CARD_BACKGROUNDS = {
  correct: "/quiz/result-cards/correct.png",
  incorrect: "/quiz/result-cards/incorrect.png",
  learned: "/quiz/result-cards/learned.png",
} as const;

const quizResultRewardPromises = new Map<
  string,
  ReturnType<typeof awardQuizResultPoints>
>();
const quizResultRewardedSessions = new Set<string>();

const QUIZ_COUNT_MIN = 10;
const QUIZ_CARD_FLIP_DURATION_MS = 250;
const QUIZ_CARD_GROW_DURATION_MS = 480;
const QUIZ_CARD_PROGRESS_DELAY_MS = 500;
const QUIZ_CARD_LARGE_HOLD_DURATION_MS = 1_400;
const QUIZ_CARD_PROGRESS_FOOTER_HEIGHT_PX = 56;
const QUIZ_CARD_RETURN_SETTLE_DURATION_MS = QUIZ_CARD_GROW_DURATION_MS + 80;

interface BaseQuizItem {
  card: VocabularyCard;
  inventoryCard: InventoryCard;
  willLearn: boolean;
  forceLearned?: boolean;
  isBonus?: false;
}

interface ChoiceQuizItem extends BaseQuizItem {
  questionType: "choice";
  question: QuizQuestion;
}

interface ListeningQuizItem extends BaseQuizItem {
  questionType: "listening";
  question: ListeningQuizQuestion;
}

interface DefinitionQuizItem extends BaseQuizItem {
  questionType: "definition";
  question: DefinitionQuizQuestion;
}

interface TextQuizItem extends BaseQuizItem {
  questionType: "text";
  question: { correctAnswer: string };
}

interface TrueFalseQuizItem extends BaseQuizItem {
  questionType: "true-false";
  question: TrueFalseQuizQuestion;
}

interface SentenceCompletionQuizItem extends BaseQuizItem {
  questionType: "sentence-completion";
  question: SentenceCompletionQuizQuestion;
  character: AiPracticeCharacter;
}

interface BonusQuizItem extends Omit<BaseQuizItem, "isBonus"> {
  isBonus: true;
  bonusId: string;
  questionType: `bonus-${BonusQuestionKind}`;
  bonusQuestion: BonusQuestion;
}

type QuizItem = ChoiceQuizItem | ListeningQuizItem | DefinitionQuizItem | TextQuizItem | TrueFalseQuizItem | SentenceCompletionQuizItem | BonusQuizItem;
type QuizAnswerFeedbackState = "idle" | "correct" | "incorrect";
type QuizCardFeedbackStage = "idle" | "growing" | "revealing" | "updating";

interface QuizRerollAction {
  onReroll: () => void;
  disabled: boolean;
  loading: boolean;
}

interface QuizCardProgressFeedback {
  id: string;
  cardId: string;
  stage: Exclude<QuizCardFeedbackStage, "idle">;
  baseCount: number;
  targetCount: number;
}

interface QuizResult {
  correct: VocabularyCard[];
  incorrect: VocabularyCard[];
  learned: VocabularyCard[];
  bonusCorrect?: number;
  bonusIncorrect?: number;
}

type QuizPerformanceLevel = "high" | "mediumHigh" | "mediumLow" | "low";
type QuizPerformanceMessageKey =
  | "quiz.resultMessageHigh1"
  | "quiz.resultMessageHigh2"
  | "quiz.resultMessageHigh3"
  | "quiz.resultMessageHigh4"
  | "quiz.resultMessageHigh5"
  | "quiz.resultMessageHigh6"
  | "quiz.resultMessageHigh7"
  | "quiz.resultMessageHigh8"
  | "quiz.resultMessageMediumHigh1"
  | "quiz.resultMessageMediumHigh2"
  | "quiz.resultMessageMediumHigh3"
  | "quiz.resultMessageMediumHigh4"
  | "quiz.resultMessageMediumHigh5"
  | "quiz.resultMessageMediumHigh6"
  | "quiz.resultMessageMediumHigh7"
  | "quiz.resultMessageMediumLow1"
  | "quiz.resultMessageMediumLow2"
  | "quiz.resultMessageMediumLow3"
  | "quiz.resultMessageMediumLow4"
  | "quiz.resultMessageMediumLow5"
  | "quiz.resultMessageLow1"
  | "quiz.resultMessageLow2"
  | "quiz.resultMessageLow3"
  | "quiz.resultMessageLow4"
  | "quiz.resultMessageLow5"
  | "quiz.resultMessageLow6";

type QuizPerformanceSummary = {
  accuracy: number;
  chestUnlocked: boolean;
  icon: typeof Trophy;
  level: QuizPerformanceLevel;
  messageKeys: readonly QuizPerformanceMessageKey[];
  ringClassName: string;
  textClassName: string;
};

const QUIZ_RESULT_MESSAGE_KEYS: Record<
  QuizPerformanceLevel,
  readonly QuizPerformanceMessageKey[]
> = {
  high: [
    "quiz.resultMessageHigh1",
    "quiz.resultMessageHigh2",
    "quiz.resultMessageHigh3",
    "quiz.resultMessageHigh4",
    "quiz.resultMessageHigh6",
    "quiz.resultMessageHigh7",
    "quiz.resultMessageHigh8",
  ],
  mediumHigh: [
    "quiz.resultMessageMediumHigh1",
    "quiz.resultMessageMediumHigh2",
    "quiz.resultMessageMediumHigh3",
    "quiz.resultMessageMediumHigh4",
    "quiz.resultMessageMediumHigh5",
    "quiz.resultMessageMediumHigh6",
    "quiz.resultMessageMediumHigh7",
  ],
  mediumLow: [
    "quiz.resultMessageMediumLow1",
    "quiz.resultMessageMediumLow2",
    "quiz.resultMessageMediumLow3",
    "quiz.resultMessageMediumLow4",
    "quiz.resultMessageMediumLow5",
  ],
  low: [
    "quiz.resultMessageLow1",
    "quiz.resultMessageLow2",
    "quiz.resultMessageLow3",
    "quiz.resultMessageLow4",
    "quiz.resultMessageLow5",
    "quiz.resultMessageLow6",
  ],
};

function getQuizResultMessageKey(
  messageKeys: readonly QuizPerformanceMessageKey[],
  results: QuizResult,
  selectedCount: number | null,
  chestOpened: boolean,
) {
  if (messageKeys.length === 0) {
    return "quiz.resultMessageMediumHigh1" as const;
  }

  const seed = [
    String(selectedCount ?? "none"),
    chestOpened ? "opened" : "closed",
    ...results.correct.map((card) => card.id),
    "|",
    ...results.incorrect.map((card) => card.id),
    "|",
    ...results.learned.map((card) => card.id),
    "|bonus",
    String(results.bonusCorrect ?? 0),
    String(results.bonusIncorrect ?? 0),
  ].join(":");

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return messageKeys[hash % messageKeys.length] ?? messageKeys[0];
}

export function QuizStation({
  mode,
  initialLanguage,
  onPhaseChange,
  onBackToMode,
}: {
  mode: PracticeMode;
  initialLanguage?: LanguageCode;
  onPhaseChange?: (phase: QuizPhase) => void;
  onBackToMode?: () => void;
}) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const recordAnswer = useInventoryStore((state) => state.recordAnswer);
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const requireAuthAction = useRequireAuthAction();
  const { user, updateProfileField } = useAuthSession();
  const { stats, refreshStats } = useProgressStats();
  const chestRewardsEnabled = mode === "active";

  const [phase, setPhase] = useState<QuizPhase>(initialLanguage ? "count" : "language");

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(
    initialLanguage ?? null,
  );
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [startSplashSelection, setStartSplashSelection] = useState<{
    count: number;
    colorClass: string;
    contentScale: number;
    chestTiers?: ChestTier[];
  } | null>(null);
  const [awardedChestTier, setAwardedChestTier] = useState<ChestTierDefinition | null>(null);
  const [deck, setDeck] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [cardProgressFeedback, setCardProgressFeedback] = useState<QuizCardProgressFeedback | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [textResult, setTextResult] = useState<
    "idle" | "correct" | "incorrect"
  >("idle");
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(
    null,
  );
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult>({
    correct: [],
    incorrect: [],
    learned: [],
  });
  const [lastLearned, setLastLearned] = useState<VocabularyCard | null>(null);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const [chestOpened, setChestOpened] = useState(false);
  const [celebrationBasePoints, setCelebrationBasePoints] = useState<number | null>(null);
  const [isAiValidating, setIsAiValidating] = useState(false);
  const [aiValidatingSentenceAnswer, setAiValidatingSentenceAnswer] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [pendingStreak, setPendingStreak] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [maxStreak, setMaxStreak] = useState(0);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [pendingAnswerWrites, setPendingAnswerWrites] = useState(0);
  const [pendingChestAward, setPendingChestAward] = useState(false);
  const [pendingStreakAward, setPendingStreakAward] = useState(false);
  const [rerollingQuestion, setRerollingQuestion] = useState(false);
  const [pendingRankUp, setPendingRankUp] = useState<RankDefinition | null>(null);
  const [pendingRankUpFromRank, setPendingRankUpFromRank] = useState<RankDefinition | null>(null);
  const [rankUpReturn, setRankUpReturn] = useState<"quiz" | "result" | null>(null);
  const [bonusFlightActive, setBonusFlightActive] = useState(false);
  const [bonusPointsDisplayed, setBonusPointsDisplayed] = useState(0);
  const [bonusScorePulse, setBonusScorePulse] = useState(0);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const streakTimeoutRef = useRef<number | null>(null);
  const deferredRecordTimeoutRef = useRef<number | null>(null);
  const cardProgressTimeoutIdsRef = useRef<number[]>([]);
  const awardedStreakSessionRef = useRef<string | null>(null);
  const quizStartRankRef = useRef<RankDefinition | null>(null);
  const quizBasePointsRef = useRef(stats.totalPoints);
  const statsRef = useRef(stats);
  const pendingAdvanceRef = useRef<AdvanceQuizOptions | null>(null);
  const rankCheckInFlightRef = useRef(false);
  const rankCheckNeededRef = useRef(false);
  const bonusFlightBaseRef = useRef(0);
  const bonusDeckTokenRef = useRef(0);
  const currentIndexRef = useRef(0);
  const redirectStartedRef = useRef(false);

  useLayoutEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    const isQuizInProgress = phase !== "language" && phase !== "count";
    setQuizRankUpDeferred(isQuizInProgress);
    return () => setQuizRankUpDeferred(false);
  }, [phase]);

  const clearCardProgressFeedback = useCallback(() => {
    cardProgressTimeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    cardProgressTimeoutIdsRef.current = [];
    setCardProgressFeedback(null);
  }, []);

  const startCardProgressFeedback = useCallback((item: QuizItem, isCorrect: boolean) => {
    if (item.questionType === "text" || item.willLearn) {
      return;
    }

    clearCardProgressFeedback();

    const id = `${currentIndex}:${item.card.id}`;
    const baseCount = item.inventoryCard.correctCount;
    const targetCount = Math.max(
      0,
      Math.min(getTierRequirement(item.card.tier), baseCount + (isCorrect ? 1 : -1)),
    );

    const schedule = (delay: number, stage: QuizCardProgressFeedback["stage"] | null) => {
      const timeoutId = window.setTimeout(() => {
        if (stage === "growing") {
          vibrate("flip");
        }

        if (stage === "updating") {
          playSoundEffect("points");
          vibrate("tap");
        }

        if (stage === null) {
          setCardProgressFeedback(null);
        } else {
          setCardProgressFeedback((current) =>
            current?.id === id
              ? { ...current, stage }
              : stage === "growing"
                ? {
                    id,
                    cardId: item.card.id,
                    stage,
                    baseCount,
                    targetCount,
                  }
                : current,
          );
        }
        cardProgressTimeoutIdsRef.current = cardProgressTimeoutIdsRef.current.filter(
          (activeTimeoutId) => activeTimeoutId !== timeoutId,
        );
      }, delay);
      cardProgressTimeoutIdsRef.current.push(timeoutId);
    };

    // The card flips first, then grows. Reveal its current progress once the
    // growth settles and wait briefly before animating the changed value.
    const growthStartAt = QUIZ_CARD_FLIP_DURATION_MS + 20;
    const growthEndAt = growthStartAt + QUIZ_CARD_GROW_DURATION_MS;
    schedule(growthStartAt, "growing");
    schedule(growthEndAt, "revealing");
    schedule(growthEndAt + QUIZ_CARD_PROGRESS_DELAY_MS, "updating");
    schedule(growthEndAt + QUIZ_CARD_LARGE_HOLD_DURATION_MS, null);
  }, [clearCardProgressFeedback, currentIndex]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (phase === "quiz-start") {
      setShowSplash(true);
    }
  }, [phase]);

  const effectivePlan = entitlements?.effectivePlan ?? "free";

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((language) => ({
        ...language,
        count: filterInventoryCards({
          cards,
          language: language.code,
          status: mode,
        }).length,
      })).filter((language) => language.count > 0),
    [cards, mode],
  );
  const practiceLanguageStats = useMemo(
    () => languageStats.filter((language) => language.code !== locale),
    [languageStats, locale],
  );
  const hiddenLocalePracticeLanguage = useMemo(
    () => languageStats.find((language) => language.code === locale) ?? null,
    [languageStats, locale],
  );

  const availableCards = useMemo(() => {
    if (!selectedLanguage) return [];
    return filterInventoryCards({
      cards,
      language: selectedLanguage,
      status: mode,
    }).map((item) => item.card);
  }, [cards, mode, selectedLanguage]);
  const canRenderPersistedQuizSetup = cards.length > 0;
  const interactionLocked = !hydrated;

  useEffect(() => {
    if (
      !hydrated ||
      mode !== "active" ||
      languageStats.length > 0 ||
      redirectStartedRef.current
    ) {
      return;
    }

    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    redirectStartedRef.current = true;
    navigateWithRouteTransition(() => router.replace("/"));
  }, [hydrated, languageStats.length, mode, router]);

  const buildDeck = useCallback(
    (language: LanguageCode, count: number | null) => {
      const source = filterInventoryCards({
        cards,
        language,
        status: mode,
      }).map((item) => item.card);
      const limited = count ? source.slice(0, count) : source;
      const shuffled = shuffle(limited);
      const hasNoLearnedCards = !cards.some((item) => item.status === "learned");

      const regularItems: QuizItem[] = shuffled.map((card, index) => {
        const inventoryCard = cards.find((item) => item.cardId === card.id)!;
        const requirement = getTierRequirement(card.tier);
        const answerLocale = getStudyLocale(card.language, locale);

        // First impression: when the user has no learned cards yet, the very first quiz card
        // is answered as a normal multiple-choice question and becomes learned immediately on success.
        if (mode === "active" && hasNoLearnedCards && index === 0) {
          return {
            card,
            inventoryCard,
            questionType: "choice",
            question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
            willLearn: true,
            forceLearned: true,
          };
        }

        const willLearn =
          inventoryCard.status !== "learned" &&
          inventoryCard.correctCount + 1 >= requirement;
        const isLearningQuestion = mode === "active" && willLearn;

        if (isLearningQuestion) {
          if (shouldUseDefinitionQuestion()) {
            const definitionQuestion = buildDefinitionQuizQuestion(
              card,
              VOCABULARY_CARDS,
              answerLocale,
            );

            if (definitionQuestion) {
              return {
                card,
                inventoryCard,
                questionType: "definition",
                question: definitionQuestion,
                willLearn: true,
              };
            }
          }

          return {
            card,
            inventoryCard,
            questionType: "text",
            question: { correctAnswer: card.term },
            willLearn: true,
          };
        }

        const sentenceCompletionQuestion = shouldUseSentenceCompletionQuestion(isLearningQuestion)
          ? buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS)
          : null;

        if (sentenceCompletionQuestion) {
          return {
            card,
            inventoryCard,
            questionType: "sentence-completion",
            question: sentenceCompletionQuestion,
            character: getRandomQuizCharacter(),
            willLearn: false,
          };
        }

        if (shouldUseTrueFalseQuestion(inventoryCard, mode)) {
          return {
            card,
            inventoryCard,
            questionType: "true-false",
            question: buildTrueFalseQuizQuestion(
              card,
              VOCABULARY_CARDS,
              answerLocale,
            ),
            willLearn: false,
          };
        }

        if (shouldUseListeningQuestion()) {
          const listeningQuestion = buildListeningQuizQuestion(
            card,
            [...VOCABULARY_CARDS, ...source],
          );

          if (listeningQuestion) {
            return {
              card,
              inventoryCard,
              questionType: "listening",
              question: listeningQuestion,
              willLearn: false,
            };
          }
        }

        return {
          card,
          inventoryCard,
          questionType: "choice",
          question: buildQuizQuestion(
            card,
            VOCABULARY_CARDS,
            answerLocale,
          ),
          willLearn: false,
        };
      });

      const bonusCards = filterInventoryCards({
        cards,
        language,
        status: "all",
      }).map((item) => item.card);
      const items: QuizItem[] = [];
      const gptJobs: Array<{
        bonusId: string;
        kind: "sentence-order" | "category-sort";
      }> = [];
      const sessionId = createQuizSessionId();
      const deckToken = bonusDeckTokenRef.current + 1;
      bonusDeckTokenRef.current = deckToken;

      regularItems.forEach((item, index) => {
        items.push(item);

        if (Math.random() >= 1 / 3) {
          return;
        }

        const kind = getBonusKind(index);
        const bonusId = `${sessionId}-${kind}-${index}`;
        const fallback = buildFallbackBonusQuestion(kind, bonusCards, language, locale, bonusId);

        if (!fallback) return;

        const anchor = regularItems[0] ?? item;
        items.push({
          card: anchor.card,
          inventoryCard: anchor.inventoryCard,
          willLearn: false,
          isBonus: true,
          bonusId,
          questionType: `bonus-${kind}`,
          bonusQuestion: fallback,
        });

        if (kind === "sentence-order" || kind === "category-sort") {
          gptJobs.push({ bonusId, kind });
        }
      });

      setDeck(items);
      clearCardProgressFeedback();
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      setShowingAnswer(false);
      setTextAnswer("");
      setTextResult("idle");
      setLastAnswerCorrect(null);
      setLastAnswer(null);
      setAiValidatingSentenceAnswer(null);
      setResults({ correct: [], incorrect: [], learned: [], bonusCorrect: 0, bonusIncorrect: 0 });
      setChestOpened(false);
      setAwardedChestTier(null);
      setStreak(0);
      setMaxStreak(0);
      setQuizSessionId(sessionId);
      awardedStreakSessionRef.current = null;
      quizStartRankRef.current = stats.rank;
      quizBasePointsRef.current = stats.totalPoints;
      setBonusPointsDisplayed(0);
      setBonusScorePulse(0);
      setBonusFlightActive(false);
      setPendingAnswerWrites(0);
      setPendingChestAward(false);
      setPendingStreakAward(false);
      setPendingRankUp(null);
      setPendingRankUpFromRank(null);
      setRankUpReturn(null);
      rankCheckNeededRef.current = false;
      pendingAdvanceRef.current = null;
      setPhase("quiz-start");

      void Promise.all(
        gptJobs.map(async (job) => {
          if (job.kind === "sentence-order") {
            const generated = await requestSentenceBonusQuestion({ language, cards: bonusCards });
            if (!generated || bonusDeckTokenRef.current !== deckToken) return;

            setDeck((current) => current.map((item, itemIndex) => {
              if (!item.isBonus || item.bonusId !== job.bonusId || itemIndex <= currentIndexRef.current) {
                return item;
              }
              const generatedQuestion = buildSentenceBonusFromGenerated(
                generated,
                bonusCards,
                job.bonusId,
              );
              return generatedQuestion ? { ...item, bonusQuestion: generatedQuestion } : item;
            }));
            return;
          }

          const generated = await requestCategoryBonusQuestion({ language, cards: bonusCards });

          if (!generated || bonusDeckTokenRef.current !== deckToken) return;

          setDeck((current) => current.map((item, itemIndex) => {
            if (!item.isBonus || item.bonusId !== job.bonusId || itemIndex <= currentIndexRef.current) return item;
            const generatedQuestion = buildCategoryBonusFromGenerated(
              generated,
              bonusCards,
              job.bonusId,
            );
            return generatedQuestion ? { ...item, bonusQuestion: generatedQuestion } : item;
          }));
        }),
      );
    },
    [cards, clearCardProgressFeedback, mode, locale, stats.rank, stats.totalPoints],
  );

  useEffect(() => {
    if (phase !== "count" || !selectedLanguage) return;
    const count = filterInventoryCards({
      cards,
      language: selectedLanguage,
      status: mode,
    }).length;
    if (count < QUIZ_COUNT_MIN) {
      // Auto-start the quiz when not enough cards are available for a count selection.
      buildDeck(selectedLanguage, null);
    }
  }, [phase, selectedLanguage, cards, mode, buildDeck]);

  const resetQuestionUi = useCallback(() => {
    clearCardProgressFeedback();
    setShowingAnswer(false);
    setTextAnswer("");
    setTextResult("idle");
    setLastAnswerCorrect(null);
    setLastAnswer(null);
    setAiValidatingSentenceAnswer(null);
    setBonusFlightActive(false);
  }, [clearCardProgressFeedback]);

  async function handleRerollQuestion() {
    const item = deck[currentIndex];
    const cost = GEM_COSTS.rerollQuestion.amount;

    if (
      !user ||
      !item ||
      isBonusQuizItem(item) ||
      showingAnswer ||
      isAiValidating ||
      rerollingQuestion ||
      (user.profile.greenGems ?? 0) < cost
    ) {
      return;
    }

    setRerollingQuestion(true);
    try {
      const result = await spendGemAction("green", cost, "reroll-question");
      if (!result.success || !result.balances) {
        return;
      }

      const answerLocale = getStudyLocale(item.card.language, locale);
      const replacement: ChoiceQuizItem = {
        card: item.card,
        inventoryCard: item.inventoryCard,
        questionType: "choice",
        question: buildQuizQuestion(item.card, VOCABULARY_CARDS, answerLocale),
        willLearn: item.willLearn,
        forceLearned: item.forceLearned,
      };

      setDeck((current) => current.map((candidate, index) => index === currentIndex ? replacement : candidate));
      resetQuestionUi();
      updateProfileField({
        greenGems: result.balances.green,
        blueGems: result.balances.blue,
        purpleGems: result.balances.purple,
      });
      playSoundEffect("gem-spend");
      vibrate("tap");
      await refreshStats();
      refreshLeaderboardPositions();
    } finally {
      setRerollingQuestion(false);
    }
  }

  const announceQuizRankUp = useCallback((rank: RankDefinition) => {
    acknowledgeRankUp(user?.id, rank.id);
    sendTwaAnalyticsEvent("fd_rank_up", {
      params: {
        rank_id: rank.id,
        rank_icon: rank.icon,
        total_points: statsRef.current.totalPoints,
        rank_min_points: rank.minPoints,
      },
    });
  }, [user?.id]);

  const advanceQuiz = useCallback(
    ({
      bypassCelebration = false,
      resultsOverride,
      skipRankUpCheck = false,
    }: AdvanceQuizOptions = {}) => {
      if (!bypassCelebration && lastLearned) {
        setPhase("celebration");
        return;
      }

      const hasNextQuestion = currentIndex + 1 < deck.length;

      // A card answer is persisted asynchronously. Wait for that write to
      // settle before comparing ranks, otherwise the quiz could advance with
      // stale progress and the global rank popover could win the race.
      if (
        !skipRankUpCheck &&
        rankCheckNeededRef.current &&
        hasNextQuestion &&
        quizStartRankRef.current
      ) {
        if (pendingAnswerWrites > 0) {
          pendingAdvanceRef.current = { bypassCelebration, resultsOverride };
          return;
        }

        if (rankCheckInFlightRef.current) {
          return;
        }

        rankCheckInFlightRef.current = true;
        void (async () => {
          let shouldResumeQuiz = true;

          try {
            await refreshStats();
            // ProgressStatsProvider updates its snapshot after inventory/profile
            // writes. Give React one task to commit that snapshot before reading
            // the rank through the ref.
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

            const previousRank = quizStartRankRef.current;
            const currentRank = statsRef.current.rank;

            if (previousRank && currentRank.minPoints > previousRank.minPoints) {
              announceQuizRankUp(currentRank);
              setPendingRankUpFromRank(previousRank);
              setPendingRankUp(currentRank);
              setRankUpReturn("quiz");
              setPhase("rank-up");
              shouldResumeQuiz = false;
            } else {
              rankCheckNeededRef.current = false;
            }
          } catch {
            // A stats refresh failure must never strand the learner between
            // questions. The regular quiz flow remains the safe fallback.
          } finally {
            rankCheckInFlightRef.current = false;
          }

          if (shouldResumeQuiz) {
            advanceQuizRef.current({
              bypassCelebration,
              resultsOverride,
              skipRankUpCheck: true,
            });
          }
        })();
        return;
      }

      if (!skipRankUpCheck && rankCheckNeededRef.current && hasNextQuestion && rankCheckInFlightRef.current) {
        return;
      }

      if (currentIndex + 1 >= deck.length) {
        const summary = getQuizPerformanceSummary(
          mode,
          resultsOverride ?? results,
          selectedCount,
          chestOpened,
        );
        if (summary.chestUnlocked && selectedCount !== null) {
          setAwardedChestTier(resolveAwardedChestTier(selectedCount) ?? null);
          setPhase("chest-celebration");
          return;
        }
        setPhase(getQuizStreakRewardPoints(maxStreak) > 0 ? "streak-reward" : "result-pending");
        return;
      }

      const nextIndex = currentIndex + 1;
      const nextItem = deck[nextIndex];
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      resetQuestionUi();

      if (phase === "streak-celebration" || phase === "celebration") {
        setPhase("quiz");
      } else if (nextItem && isBonusQuizItem(nextItem)) {
        setPhase("bonus-intro");
      } else {
        setPhase("quiz");
      }
    },
    [
      chestOpened,
      currentIndex,
      deck,
      lastLearned,
      maxStreak,
      mode,
      pendingAnswerWrites,
      phase,
      refreshStats,
      resetQuestionUi,
      results,
      selectedCount,
      announceQuizRankUp,
    ],
  );

  const queueAutoAdvance = useCallback(
    (resultsOverride?: QuizResult) => {
      if (autoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }

      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        advanceQuiz({ bypassCelebration: true, resultsOverride });
        autoAdvanceTimeoutRef.current = null;
      }, 0);
    },
    [advanceQuiz],
  );

  useEffect(
    () => () => {
      if (autoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (streakTimeoutRef.current !== null) {
        window.clearTimeout(streakTimeoutRef.current);
      }
      if (deferredRecordTimeoutRef.current !== null) {
        window.clearTimeout(deferredRecordTimeoutRef.current);
      }
      cardProgressTimeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    },
    [],
  );

  const advanceQuizRef = useRef(advanceQuiz);

  useEffect(() => {
    advanceQuizRef.current = advanceQuiz;
  });

  useEffect(() => {
    if (pendingAnswerWrites > 0 || !pendingAdvanceRef.current || rankCheckInFlightRef.current) {
      return;
    }

    const pendingAdvance = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    advanceQuizRef.current(pendingAdvance);
  }, [pendingAnswerWrites]);


  function handleSelectLanguage(language: LanguageCode) {
    setSelectedLanguage(language);
    const count = filterInventoryCards({
      cards,
      language,
      status: mode,
    }).length;

    if (count < QUIZ_COUNT_MIN) {
      buildDeck(language, null);
      return;
    }

    setSelectedCount(null);
    setChestOpened(false);
    setAwardedChestTier(null);
    setPhase("count");
  }

  function handleStartCount(count: number) {
    if (!selectedLanguage) return;
    setSelectedCount(count);
    setAwardedChestTier(null);
    buildDeck(selectedLanguage, count);
  }

  async function handleTextSubmit(rawAnswer: string) {
    if (showingAnswer || isAiValidating) return;

    const item = deck[currentIndex];
    if (item.questionType !== "text") return;

    const question = item.question;
    const isDirectlyCorrect = isAnswerSimilarEnough(rawAnswer, question.correctAnswer);

    if (isDirectlyCorrect) {
      handleAnswer(rawAnswer, true);
      return;
    }

    setIsAiValidating(true);

    const promptContext = [
      getCardTranslation(item.card, locale),
      item.card.examples[0]?.sentence,
    ]
      .filter(Boolean)
      .join(" — ");

    try {
      const result = await aiValidateTextAnswer({
        userAnswer: rawAnswer,
        correctAnswers: [question.correctAnswer],
        sourceAnswers: getCardTranslationMeanings(item.card, locale),
        targetLanguage: item.card.language,
        sourceLanguage: locale,
        promptContext,
      });

      if (result.errorCode) {
        setLimitError(result.errorCode);
        setIsAiValidating(false);
        return;
      }

      handleAnswer(rawAnswer, result.accepted);
    } catch {
      handleAnswer(rawAnswer, false);
    } finally {
      setIsAiValidating(false);
    }
  }

  async function handleSentenceCompletionAnswer(answer: string, isCorrectOption: boolean) {
    if (showingAnswer || isAiValidating) return;

    const item = deck[currentIndex];
    if (item.questionType !== "sentence-completion") return;

    if (isCorrectOption) {
      handleAnswer(answer, true);
      return;
    }

    const { question } = item;
    setAiValidatingSentenceAnswer(answer);
    setIsAiValidating(true);

    try {
      const result = await aiValidateTextAnswer({
        validationKind: "sentence_completion",
        userAnswer: answer,
        correctAnswers: [question.correctAnswer],
        sourceAnswers: getCardTranslationMeanings(item.card, locale),
        targetLanguage: item.card.language,
        sourceLanguage: locale,
        promptContext: [
          `Sentence with blank: ${question.sentenceWithBlank}`,
          `Canonical completed sentence: ${completeSentence(question.sentenceWithBlank, question.correctAnswer)}`,
          `User completed sentence: ${completeSentence(question.sentenceWithBlank, answer)}`,
        ].join("\n"),
      });

      // A quota, network, or model failure is intentionally counted as incorrect.
      handleAnswer(answer, result.accepted);
    } catch {
      handleAnswer(answer, false);
    } finally {
      setIsAiValidating(false);
      setAiValidatingSentenceAnswer(null);
    }
  }

  function handleBonusAnswer(answer: string, isCorrect: boolean) {
    if (showingAnswer) return;

    const item = deck[currentIndex];
    if (!item || !isBonusQuizItem(item)) return;

    requireAuthAction(
      () => {
        const nextStreak = isCorrect ? streak + 1 : 0;

        flushSync(() => {
          setShowingAnswer(true);
          setTextResult(isCorrect ? "correct" : "incorrect");
          setLastAnswerCorrect(isCorrect);
          setLastAnswer(answer);
        });

        setResults((current) => ({
          ...current,
          bonusCorrect: (current.bonusCorrect ?? 0) + (isCorrect ? 1 : 0),
          bonusIncorrect: (current.bonusIncorrect ?? 0) + (isCorrect ? 0 : 1),
        }));
        setStreak(nextStreak);
        setMaxStreak((current) => Math.max(current, nextStreak));

        if (isCorrect) {
          rankCheckNeededRef.current = true;
          setBonusFlightActive(true);
          if (quizSessionId) {
            void awardQuizBonusPoints(quizSessionId, item.bonusId);
          }
        }

        playSoundEffect(isCorrect ? "correct" : "incorrect");
        vibrate(isCorrect ? "correct" : "incorrect");

        if (nextStreak > 0 && nextStreak % 5 === 0) {
          setPendingStreak(true);
        }
      },
      { nextPath: `/learn?mode=${mode}` },
    );
  }

  function handleSkip() {
    if (showingAnswer || isAiValidating) return;

    const item = deck[currentIndex];
    if (!item) return;

    // Skipping follows the normal incorrect-answer path but deliberately
    // bypasses text/sentence AI validation.
    handleAnswer("", false);
  }

  async function handleAnswer(answer: string, isCorrect: boolean) {
    if (showingAnswer) return;

    const item = deck[currentIndex];
    if (!item) return;
    if (isBonusQuizItem(item)) {
      handleBonusAnswer(answer, isCorrect);
      return;
    }
    const correctAnswer = item.question.correctAnswer;

    if (item.willLearn && isCorrect) {
      const learnedLimit = PLAN_LIMITS[effectivePlan].learnedCards;

      if (effectivePlan === "free" && typeof learnedLimit === "number") {
        const learnedCount = cards.filter(
          (card) => card.status === "learned",
        ).length;

        if (learnedCount >= learnedLimit) {
          const nextResults: QuizResult = {
            correct: [...results.correct, item.card],
            incorrect: results.incorrect,
            learned: results.learned,
            bonusCorrect: results.bonusCorrect,
            bonusIncorrect: results.bonusIncorrect,
          };

          playSoundEffect("correct");
          vibrate("correct");
          setResults(nextResults);
          setLimitError("free_learned_card_limit");
          queueAutoAdvance(nextResults);
          return;
        }
      }
    }

    requireAuthAction(
      () => {
        const willLearn = item.willLearn && isCorrect;
        const nextStreak = isCorrect ? streak + 1 : 0;

        flushSync(() => {
          setShowingAnswer(true);
          setTextResult(isCorrect ? "correct" : "incorrect");
          setLastAnswerCorrect(isCorrect);
          setLastAnswer(answer);
        });

        startCardProgressFeedback(item, isCorrect);

        playSoundEffect(isCorrect ? "correct" : "incorrect");
        vibrate(isCorrect ? "correct" : "incorrect");

        setResults((current) => ({
          correct: isCorrect
            ? [...current.correct, item.card]
            : current.correct,
          incorrect: !isCorrect
            ? [...current.incorrect, item.card]
            : current.incorrect,
          learned: willLearn
            ? [...current.learned, item.card]
            : current.learned,
        }));

        if (willLearn) {
          rankCheckNeededRef.current = true;
          setLastLearned(item.card);
          setCelebrationBasePoints(stats.totalPoints);
        }

        setStreak(nextStreak);
        setMaxStreak((current) => Math.max(current, nextStreak));
        if (nextStreak > 0 && nextStreak % 5 === 0) {
          setPendingStreak(true);
          streakTimeoutRef.current = window.setTimeout(() => {
            setPhase("streak-celebration");
            setPendingStreak(false);
            streakTimeoutRef.current = null;
          }, 850);
        }

        if (deferredRecordTimeoutRef.current !== null) {
          window.clearTimeout(deferredRecordTimeoutRef.current);
        }
        setPendingAnswerWrites((current) => current + 1);
        deferredRecordTimeoutRef.current = window.setTimeout(() => {
          void recordAnswer({
            cardId: item.card.id,
            selectedAnswer: answer,
            correctAnswer,
            isCorrect,
            mode,
            forceLearned: item.forceLearned,
          }).finally(() => {
            setPendingAnswerWrites((current) => Math.max(0, current - 1));
          });
          deferredRecordTimeoutRef.current = null;
        }, 0);
      },
      {
        nextPath: `/learn?mode=${mode}`,
      },
    );
  }

  function handleNext() {
    if (pendingStreak || bonusFlightActive) return;
    clearCardProgressFeedback();
    advanceQuiz();
  }

  function handleContinueFromCelebration() {
    setLastLearned(null);
    setCelebrationBasePoints(null);
    advanceQuiz({ bypassCelebration: true });
  }

  function handleRestart() {
    if (selectedLanguage && selectedCount !== null) {
      setStartSplashSelection({
        count: selectedCount,
        colorClass: getQuizCountButtonColor(selectedCount),
        contentScale: 1,
        chestTiers: chestRewardsEnabled ? getChestPreviewPairForCount(selectedCount) : undefined,
      });
      setChestOpened(false);
      setAwardedChestTier(null);
      buildDeck(selectedLanguage, selectedCount);
      return;
    }

    if (selectedLanguage) {
      const count = filterInventoryCards({
        cards,
        language: selectedLanguage,
        status: mode,
      }).length;

      if (count < QUIZ_COUNT_MIN) {
        buildDeck(selectedLanguage, null);
        return;
      }
    }

    setChestOpened(false);
    setPhase("count");
  }

  function handleExit() {
    navigateWithRouteTransition(() => router.push("/"));
  }

  const handleBonusIntroComplete = useCallback(() => {
    setPhase("quiz");
  }, []);

  function handleChestComplete() {
    if (chestOpened) {
      setPhase(getQuizStreakRewardPoints(maxStreak) > 0 ? "streak-reward" : "result-pending");
      return;
    }

    setChestOpened(true);
    setPhase(getQuizStreakRewardPoints(maxStreak) > 0 ? "streak-reward" : "result-pending");
  }

  async function prepareChestReward(tier: ChestTierDefinition["tier"]): Promise<ChestRewardOutcome | null> {
    if (!user || !quizSessionId) return null;
    setPendingChestAward(true);
    try {
      const result = await awardChestPoints(tier, quizSessionId);
      if (!result.success) return null;

      updateProfileField({
        chestPoints: result.awarded === false
          ? user.profile.chestPoints ?? 0
          : (user.profile.chestPoints ?? 0) + (result.points ?? 0),
        blueGems: result.balances?.blue,
        greenGems: result.balances?.green,
        purpleGems: result.balances?.purple,
      });
      await refreshStats();
      refreshLeaderboardPositions();
      return result.gemRewards?.length
        ? { points: result.points ?? getChestRewardPoints(tier), rewards: result.gemRewards, balances: result.balances }
        : null;
    } finally {
      setPendingChestAward(false);
    }
  }

  useEffect(() => {
    if (phase !== "result-pending" || !user || !quizSessionId) {
      return;
    }

    if (awardedStreakSessionRef.current === quizSessionId) {
      return;
    }

    awardedStreakSessionRef.current = quizSessionId;

    const rewardableStreak = getRewardableQuizStreak(maxStreak);
    const streakPoints = getQuizStreakRewardPoints(maxStreak);

    if (rewardableStreak <= 0 || streakPoints <= 0) {
      return;
    }

    setPendingStreakAward(true);
    updateProfileField({
      streakPoints: (user.profile.streakPoints ?? 0) + streakPoints,
    });

    void (async () => {
      try {
        const result = await awardQuizStreakPoints(quizSessionId, maxStreak);

        if (result.success) {
          await refreshStats();
          refreshLeaderboardPositions();
          return;
        }

        await refreshStats();
      } finally {
        setPendingStreakAward(false);
      }
    })();
  }, [maxStreak, phase, quizSessionId, refreshStats, updateProfileField, user]);

  const requiresStreakAward =
    phase === "result-pending" &&
    user !== null &&
    quizSessionId !== null &&
    awardedStreakSessionRef.current !== quizSessionId &&
    getQuizStreakRewardPoints(maxStreak) > 0;

  useEffect(() => {
    if (
      phase !== "result-pending" ||
      pendingAnswerWrites > 0 ||
      pendingChestAward ||
      pendingStreakAward ||
      requiresStreakAward
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const startRank = quizStartRankRef.current;
      const didRankUp = startRank !== null && stats.rank.minPoints > startRank.minPoints;

      if (didRankUp) {
        announceQuizRankUp(stats.rank);
        setPendingRankUpFromRank(startRank);
        setPendingRankUp(stats.rank);
        setRankUpReturn("result");
        setPhase("rank-up");
        return;
      }

      setPhase("result");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    pendingAnswerWrites,
    pendingChestAward,
    pendingStreakAward,
    phase,
    requiresStreakAward,
    announceQuizRankUp,
    stats.rank,
    stats.totalPoints,
    user?.id,
  ]);

  if (!hydrated && !canRenderPersistedQuizSetup) {
    return (
      <EmptyState
        title={t("quiz.loadingTitle")}
        description={t("quiz.loadingDescription")}
      />
    );
  }

  if (
    languageStats.length === 0 &&
    (phase === "language" || phase === "count")
  ) {
    return (
      <EmptyState
        className="max-lg:hidden"
        title={t(
          mode === "active"
            ? "inventory.emptyAnyTitle"
            : "inventory.emptyAnyLearnedTitle",
        )}
        description={t(
          mode === "active"
            ? "inventory.emptyAnyDescription"
            : "quiz.noLearnedDescription",
        )}
        action={
          <Button onClick={() => {
            navigateWithRouteTransition(() => router.push("/card-draw"));
          }}>
            {t("quiz.backToDraw")}
          </Button>
        }
      />
    );
  }

  if (phase === "language") {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <LanguageSelection
          mode={mode}
          languageStats={practiceLanguageStats}
          hiddenLanguageCode={hiddenLocalePracticeLanguage?.code ?? null}
          selectedLanguage={selectedLanguage}
          locked={interactionLocked}
          onSelect={handleSelectLanguage}
          onBack={onBackToMode}
        />
      </div>
    );
  }

  if (phase === "count" && selectedLanguage) {
    return (
      <div className="flex flex-1 flex-col items-stretch">
        <CountSelection
          mode={mode}
          language={selectedLanguage}
          availableCount={availableCards.length}
          selectedCount={selectedCount}
          locked={interactionLocked}
          onSelect={(count, selection) => {
            setStartSplashSelection(selection);
            setSelectedCount(count);
            handleStartCount(count);
          }}
        />
      </div>
    );
  }

  if (!hydrated) {
    return (
      <EmptyState
        title={t("quiz.loadingTitle")}
        description={t("quiz.loadingDescription")}
      />
    );
  }

  if (phase === "celebration" && lastLearned) {
    return (
      <CelebrationView
        card={lastLearned}
        basePoints={celebrationBasePoints ?? stats.totalPoints}
        onContinue={handleContinueFromCelebration}
      />
    );
  }

  if (phase === "result") {
    return (
      <QuizViewportOverlay
        learnPagePhase="result"
        overlay="result"
        className="animate-screen-pop fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-background p-4 max-lg:bottom-0 max-lg:top-[var(--app-header-height)] max-lg:p-0 lg:bottom-0 lg:top-16"
      >
        <div className="flex h-full w-full max-w-3xl items-center justify-center">
          <ResultView
            mode={mode}
            results={results}
            selectedCount={selectedCount}
            chestOpened={chestOpened}
            quizSessionId={quizSessionId ?? undefined}
            streakRewardStreak={getRewardableQuizStreak(maxStreak)}
            streakRewardPoints={getQuizStreakRewardPoints(maxStreak)}
            locked={false}
            onRestart={handleRestart}
            onExit={handleExit}
          />
        </div>
      </QuizViewportOverlay>
    );
  }

  if (phase === "rank-up" && pendingRankUp) {
    return (
      <RankUpMenu
        rank={pendingRankUp}
        fromRank={pendingRankUpFromRank ?? undefined}
        onClose={() => {
          const completedRank = pendingRankUp;
          const returnTo = rankUpReturn;

          setPendingRankUp(null);
          setPendingRankUpFromRank(null);
          setRankUpReturn(null);

          if (completedRank) {
            // The next rank check must start from the rank the user just saw.
            // This also allows a later question to present another rank-up in
            // the same quiz without replaying the same one.
            quizStartRankRef.current = completedRank;
            rankCheckNeededRef.current = false;
          }

          if (returnTo === "quiz") {
            setLastLearned(null);
            setCelebrationBasePoints(null);
            advanceQuizRef.current({
              bypassCelebration: true,
              skipRankUpCheck: true,
            });
            return;
          }

          setPhase("result");
        }}
      />
    );
  }

  if (phase === "streak-celebration") {
    return (
      <QuizStreakCelebrationView
        streak={streak}
        onComplete={() => advanceQuizRef.current()}
      />
    );
  }

  if (phase === "streak-reward") {
    return (
      <QuizStreakRewardView
        streak={getRewardableQuizStreak(maxStreak)}
        points={getQuizStreakRewardPoints(maxStreak)}
        totalPoints={stats.totalPoints}
        quizSessionId={quizSessionId ?? undefined}
        onComplete={() => setPhase("result-pending")}
      />
    );
  }

  if (phase === "chest-celebration") {
    return (
      <QuizViewportOverlay
        overlay="chest"
        className="animate-screen-pop fixed inset-0 z-[100] flex items-center justify-center bg-background p-0"
      >
        <ChestCelebrationView
          onComplete={() => setPhase("chest")}
        />
      </QuizViewportOverlay>
    );
  }

  if (chestRewardsEnabled && phase === "chest" && selectedCount) {
    const tier = awardedChestTier ?? getChestTierByCount(selectedCount);

    if (tier) {
      return (
        <QuizViewportOverlay
          overlay="chest"
          className="animate-screen-pop fixed inset-0 z-40 flex items-center justify-center bg-background p-0 sm:p-6"
        >
          <ChestOpeningView
            tier={tier}
            totalPoints={stats.totalPoints}
            onComplete={handleChestComplete}
            onRewardReady={() => prepareChestReward(tier.tier)}
          />
        </QuizViewportOverlay>
      );
    }
  }

  const isQuizPhase = phase === "quiz" || phase === "quiz-start" || phase === "bonus-intro";

  if (!isQuizPhase) {
    return null;
  }

  const item = deck[currentIndex];

  if (!item) {
    return (
      <EmptyState
        title={t(
          mode === "active" ? "quiz.noActiveTitle" : "quiz.noLearnedTitle",
        )}
        description={t(
          mode === "active"
            ? "quiz.noActiveDescription"
            : "quiz.noLearnedDescription",
        )}
        action={
          <Link href="/card-draw" className={buttonClassName("primary", "md")}>
            {t("quiz.backToDraw")}
          </Link>
        }
      />
    );
  }

  const isSplash = phase === "quiz-start";
  const isBonusIntro = phase === "bonus-intro";
  const regularProgress = getRegularQuizProgress(deck, currentIndex);
  const isCardFirstQuestion =
    !isBonusQuizItem(item) &&
    (item.questionType === "choice" ||
      item.questionType === "listening" ||
      item.questionType === "definition" ||
      item.questionType === "true-false");
  const activeCardFeedback = cardProgressFeedback?.cardId === item.card.id
    ? cardProgressFeedback
    : null;
  const cardFeedbackStage: QuizCardFeedbackStage = activeCardFeedback?.stage ?? "idle";
  const cardFooterMode = cardFeedbackStage === "revealing" || cardFeedbackStage === "updating"
    ? "progress"
    : "empty";
  const cardFooterProgressCount = cardFeedbackStage === "updating"
    ? activeCardFeedback?.targetCount
    : activeCardFeedback?.baseCount;
  const rerollAction: QuizRerollAction | undefined = !isBonusQuizItem(item)
    ? {
        onReroll: () => void handleRerollQuestion(),
        disabled:
          !user ||
          rerollingQuestion ||
          showingAnswer ||
          isAiValidating ||
          (user.profile.greenGems ?? 0) < GEM_COSTS.rerollQuestion.amount,
        loading: rerollingQuestion,
      }
    : undefined;

  return (
    <>
      {isSplash || showSplash ? (
        <QuizStartSplash
          onComplete={() => setPhase("quiz")}
          onExited={() => {
            setShowSplash(false);
            setStartSplashSelection(null);
          }}
          selectedCount={startSplashSelection?.count}
          selectedColorClass={startSplashSelection?.colorClass}
          selectedContentScale={startSplashSelection?.contentScale}
          selectedChestTiers={startSplashSelection?.chestTiers}
        />
      ) : null}
      {isBonusIntro ? <BonusQuestionIntro onComplete={handleBonusIntroComplete} /> : null}
      {!isSplash ? (
        <MobileQuizTopBar
          currentIndex={regularProgress.current - 1}
          total={regularProgress.total}
          totalPoints={Math.max(stats.totalPoints, quizBasePointsRef.current + bonusPointsDisplayed)}
          scorePulse={bonusScorePulse}
          onExit={handleExit}
        />
      ) : null}
      <div
        className={cn(
          "mx-auto flex h-auto w-full max-w-5xl flex-col justify-center bg-background max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-[var(--app-header-height)] max-lg:max-w-none max-lg:justify-start max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:touch-pan-y lg:h-full",
          isSplash || isBonusIntro ? "opacity-0" : "animate-screen-pop",
        )}
        data-learn-quiz-page="quiz"
      >
        <div
          className="flex min-h-full w-full flex-col items-center justify-center gap-3 px-4 py-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:px-0 lg:py-0"
          data-quiz-mobile-layout={item.questionType}
        >
          {isCardFirstQuestion ? (
            <p
              className="order-1 mt-6 text-center text-sm font-semibold text-foreground-muted max-lg:text-white lg:hidden"
              data-quiz-mobile-prompt
            >
              {item.questionType === "true-false"
                ? t("games.wordChallenge.title")
                : t("quiz.recallPrompt")}
            </p>
          ) : null}

          <div
            className={cn(
              "flex w-full max-w-md flex-col justify-center gap-3 max-lg:pb-3 lg:order-1 lg:col-start-1 lg:row-start-1 lg:max-w-none lg:gap-4",
              isCardFirstQuestion ? "order-3" : "order-1",
            )}
            data-quiz-mobile-question
          >
            <QuizCounter currentIndex={regularProgress.current - 1} total={regularProgress.total} />
            <QuizProgressHeader mode={mode} item={item} />
            <div className="flex flex-1 flex-col justify-center">
              {isBonusQuizItem(item) ? (
                <BonusQuestionView
                  key={currentIndex}
                  question={item.bonusQuestion}
                  showingAnswer={showingAnswer}
                  answerAccepted={lastAnswerCorrect}
                  canAdvance={!pendingStreak && !bonusFlightActive}
                  onSubmit={handleBonusAnswer}
                  onSkip={handleSkip}
                  onNext={handleNext}
                  onFlightStart={() => {
                    bonusFlightBaseRef.current = bonusPointsDisplayed;
                  }}
                  onPointArrive={(points) => {
                    setBonusPointsDisplayed((current) =>
                      Math.max(current, bonusFlightBaseRef.current + points),
                    );
                    setBonusScorePulse((current) => current + 1);
                  }}
                  onFlightComplete={() => {
                    setBonusFlightActive(false);
                    void refreshStats();
                    refreshLeaderboardPositions();
                    if (pendingStreak) {
                      setPendingStreak(false);
                      setPhase("streak-celebration");
                    }
                  }}
                />
              ) : item.questionType === "choice" ? (
                <ChoiceQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  promptClassName="max-lg:hidden"
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                />
              ) : item.questionType === "listening" ? (
                <ListeningQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                />
              ) : item.questionType === "definition" ? (
                <DefinitionQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                />
              ) : item.questionType === "true-false" ? (
                <TrueFalseQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  promptClassName="max-lg:hidden"
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                />
              ) : item.questionType === "sentence-completion" ? (
                <SentenceCompletionQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  isAiValidating={isAiValidating}
                  aiValidatingAnswer={aiValidatingSentenceAnswer}
                  selectedAnswer={lastAnswer}
                  answerAccepted={lastAnswerCorrect}
                  onAnswer={handleSentenceCompletionAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                  mobileCard={(
                    <div className="flex items-center justify-center lg:hidden" data-quiz-mobile-card-slot>
                      <MobileQuizCard
                        item={item}
                        face={showingAnswer ? "front" : "back"}
                        feedbackStage={cardFeedbackStage}
                        footerMode={cardFooterMode}
                        footerProgressCount={cardFooterProgressCount}
                      />
                    </div>
                  )}
                />
              ) : (
                <TextQuestion
                  key={currentIndex}
                  item={item}
                  textAnswer={textAnswer}
                  textResult={textResult}
                  showingAnswer={showingAnswer}
                  isAiValidating={isAiValidating}
                  onChange={setTextAnswer}
                  onSubmitText={handleTextSubmit}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={!pendingStreak}
                  isFirstQuestion={currentIndex === 0}
                />
              )}
            </div>
          </div>

          {!isBonusQuizItem(item) && item.questionType !== "sentence-completion" ? (
            <div
              className="order-2 flex items-center justify-center lg:hidden"
              data-quiz-mobile-card-slot
            >
              <MobileQuizCard
                item={item}
                face={showingAnswer ? "front" : "back"}
                feedbackStage={cardFeedbackStage}
                footerMode={cardFooterMode}
                footerProgressCount={cardFooterProgressCount}
              />
            </div>
          ) : null}

          {!isBonusQuizItem(item) ? <div className="hidden h-[440px] items-center justify-center lg:order-2 lg:col-start-2 lg:row-start-1 lg:flex">
            <div
              className={cn(
                "relative h-[440px] w-auto transform-gpu transition-transform duration-200 ease-out will-change-transform focus:outline-none",
                cardFeedbackStage !== "idle" && "z-20 -translate-x-16 scale-[1.1]",
              )}
              data-quiz-card-feedback={cardFeedbackStage}
              aria-hidden="true"
            >
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={showingAnswer ? "front" : "back"}
                flippable={false}
                footerMode={cardFooterMode}
                footerProgressCount={cardFooterProgressCount}
                className="h-full w-auto min-h-0 max-w-full"
              />
            </div>
          </div> : null}
        </div>
      </div>

        <MobileQuizFeedback
          isOpen={showingAnswer && lastAnswerCorrect !== null && !isSplash}
          isCorrect={lastAnswerCorrect ?? false}
          correctAnswer={
            isBonusQuizItem(item)
              ? undefined
              : item.questionType === "text" || item.questionType === "sentence-completion"
                ? item.question.correctAnswer
                : item.questionType === "listening"
                  ? item.question.correctAnswer
                  : item.questionType === "true-false"
                    ? item.question.actualMeaning
                    : undefined
          }
          onNext={handleNext}
          showNextButton={!pendingStreak && !bonusFlightActive}
        />

      <UpgradeDialog
        open={limitError !== null}
        errorCode={limitError}
        onOpenChange={(open) => {
          if (!open) {
            setLimitError(null);
          }
        }}
        selectedLanguage={selectedLanguage ?? undefined}
      />
    </>
  );
}

function MobileQuizCard({
  item,
  face,
  feedbackStage,
  footerMode,
  footerProgressCount,
}: {
  item: QuizItem;
  face: "front" | "back";
  feedbackStage: QuizCardFeedbackStage;
  footerMode: "empty" | "progress";
  footerProgressCount?: number;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const centerFrameRef = useRef<number | null>(null);
  const returnTimeoutRef = useRef<number | null>(null);
  const [floatingFrame, setFloatingFrame] = useState<{
    origin: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    returnTarget?: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  } | null>(null);
  const [isCentered, setIsCentered] = useState(false);
  const isFeedbackActive = feedbackStage !== "idle";

  useLayoutEffect(() => {
    if (!slotRef.current) return;

    if (isFeedbackActive && !floatingFrame) {
      const rect = slotRef.current.getBoundingClientRect();
      setFloatingFrame({
        origin: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      return;
    }

    // The quiz layout can move while feedback is visible. Read the slot again
    // after the footer disappears so the floating card returns to its real home.
    if (!isFeedbackActive && floatingFrame && !floatingFrame.returnTarget) {
      const rect = slotRef.current.getBoundingClientRect();
      setFloatingFrame((current) =>
        current
          ? {
              ...current,
              returnTarget: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              },
            }
          : current,
      );
    }
  }, [floatingFrame, isFeedbackActive]);

  useEffect(() => {
    if (!floatingFrame) return;

    if (isFeedbackActive) {
      centerFrameRef.current = window.requestAnimationFrame(() => setIsCentered(true));
      return () => {
        if (centerFrameRef.current !== null) {
          window.cancelAnimationFrame(centerFrameRef.current);
          centerFrameRef.current = null;
        }
      };
    }

    if (!floatingFrame.returnTarget) return;

    centerFrameRef.current = window.requestAnimationFrame(() => setIsCentered(false));
    returnTimeoutRef.current = window.setTimeout(() => {
      setFloatingFrame(null);
      returnTimeoutRef.current = null;
    }, QUIZ_CARD_RETURN_SETTLE_DURATION_MS);

    return () => {
      if (centerFrameRef.current !== null) {
        window.cancelAnimationFrame(centerFrameRef.current);
        centerFrameRef.current = null;
      }
      if (returnTimeoutRef.current !== null) {
        window.clearTimeout(returnTimeoutRef.current);
        returnTimeoutRef.current = null;
      }
    };
  }, [floatingFrame, isFeedbackActive]);

  useEffect(() => () => {
    if (centerFrameRef.current !== null) {
      window.cancelAnimationFrame(centerFrameRef.current);
    }
    if (returnTimeoutRef.current !== null) {
      window.clearTimeout(returnTimeoutRef.current);
    }
  }, []);

  const returnOffset = floatingFrame?.returnTarget
    ? {
        x: floatingFrame.returnTarget.left - floatingFrame.origin.left,
        y: floatingFrame.returnTarget.top - floatingFrame.origin.top,
      }
    : { x: 0, y: 0 };
  const centerOffset = floatingFrame && typeof window !== "undefined"
    ? {
        x: window.innerWidth / 2 - (floatingFrame.origin.left + floatingFrame.origin.width / 2),
        y: window.innerHeight / 2 - (floatingFrame.origin.top + floatingFrame.origin.height / 2),
      }
    : null;
  const floatingStyle: CSSProperties | undefined = floatingFrame
    ? {
        left: floatingFrame.origin.left,
        top: floatingFrame.origin.top,
        width: floatingFrame.origin.width,
        height: floatingFrame.origin.height,
        transformOrigin: "center",
        transform: isCentered && centerOffset
          ? `translate3d(${centerOffset.x}px, ${centerOffset.y}px, 0) scale(1.35)`
          : `translate3d(${returnOffset.x}px, ${returnOffset.y}px, 0) scale(1)`,
      }
    : undefined;
  const cardShellStyle: CSSProperties | undefined = floatingFrame
    ? {
      height: isCentered
        ? `calc(100% + ${QUIZ_CARD_PROGRESS_FOOTER_HEIGHT_PX}px)`
        : "100%",
      transform: isCentered
        ? `translateY(-${QUIZ_CARD_PROGRESS_FOOTER_HEIGHT_PX / 2}px)`
        : "translateY(0)",
      }
    : undefined;

  const cardFrame = (
    <div
      className={cn(
        "h-full w-full transform-gpu transition-transform duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        // Above the question UI, below every quiz-wide overlay (streak, rewards, results).
        floatingFrame ? "fixed z-20" : "relative",
      )}
      data-quiz-card-feedback={feedbackStage}
      style={floatingStyle}
    >
      <div
        className="h-full w-full transition-[height,transform] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={cardShellStyle}
      >
        <VocabularyCardView
          card={item.card}
          inventory={item.inventoryCard}
          owned
          initialFace="back"
          face={face}
          flippable={false}
          footerMode={footerMode}
          footerProgressCount={footerProgressCount}
          className="h-full w-full min-h-0 max-sm:min-h-0"
        />
      </div>
    </div>
  );

  return (
    <div
      ref={slotRef}
      className={cn(
        "relative aspect-[3/4] w-[min(285px,calc((100vw-3rem)/2))] max-w-full shrink-0",
      )}
      data-quiz-mobile-card
      data-quiz-mobile-card-kind={item.questionType}
      data-quiz-card-term={item.card.term}
      data-quiz-card-feedback={feedbackStage}
    >
      {floatingFrame ? createPortal(cardFrame, document.body) : cardFrame}
    </div>
  );
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

const BONUS_QUESTION_KINDS: readonly BonusQuestionKind[] = [
  "matching",
  "sentence-order",
  "category-sort",
  "imposter",
];

function getBonusKind(index: number): BonusQuestionKind {
  const randomOffset = Math.floor(Math.random() * BONUS_QUESTION_KINDS.length);
  return BONUS_QUESTION_KINDS[(index + randomOffset) % BONUS_QUESTION_KINDS.length] ?? "matching";
}

function buildFallbackBonusQuestion(
  kind: BonusQuestionKind,
  cards: VocabularyCard[],
  language: LanguageCode,
  locale: LocaleCode,
  seed: string,
): BonusQuestion | null {
  if (kind === "matching") {
    return buildMatchingBonusQuestion(cards, locale, seed);
  }

  if (kind === "sentence-order") {
    return buildFallbackSentenceOrderQuestion(cards, seed);
  }

  if (kind === "category-sort") {
    return buildFallbackCategoryBonusQuestion(language, seed);
  }

  return buildImposterBonusQuestion(language, seed);
}

function isBonusQuizItem(item: QuizItem): item is BonusQuizItem {
  return item.isBonus === true;
}

function getRegularQuizProgress(deck: QuizItem[], currentIndex: number) {
  const regularItems = deck.filter((item) => !isBonusQuizItem(item));
  const currentRegularCount = deck
    .slice(0, currentIndex + 1)
    .filter((item) => !isBonusQuizItem(item)).length;

  return {
    current: Math.max(1, currentRegularCount),
    total: Math.max(1, regularItems.length),
  };
}

function completeSentence(sentenceWithBlank: string, answer: string) {
  return sentenceWithBlank.replace("_____", answer);
}

function getRandomQuizCharacter() {
  const characters = getAiPracticeCharacters();
  return characters[Math.floor(Math.random() * characters.length)]!;
}

export function LanguageSelection({
  mode,
  languageStats,
  hiddenLanguageCode,
  selectedLanguage,
  locked = false,
  onSelect,
  onBack,
}: {
  mode: PracticeMode;
  languageStats: Array<{
    code: LanguageCode;
    count: number;
    nativeName: string;
  }>;
  hiddenLanguageCode: LanguageCode | null;
  selectedLanguage: LanguageCode | null;
  locked?: boolean;
  onSelect: (language: LanguageCode) => void;
  onBack?: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const hiddenLanguageName = hiddenLanguageCode
    ? getLanguageDisplayName(hiddenLanguageCode, locale)
    : null;
  const modeColor = MODE_STYLE[mode].bg;

  return (
    <div
      data-quiz-language-selection
      className={cn(
        "animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background p-5 text-foreground transition-colors duration-300 sm:p-8 lg:min-w-[56rem] lg:max-w-5xl lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4",
        modeColor,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-4xl">
          <h2 className="mt-4 text-center text-lg font-semibold text-foreground max-lg:text-white lg:text-2xl">
            {t("quiz.chooseLanguageTitle")}
          </h2>
          {hiddenLanguageName ? (
            <p className="mt-2 text-center text-xs leading-5 text-foreground/65 max-lg:text-white/80 lg:text-sm">
              {t("quiz.hiddenSiteLanguageHint", {
                language: hiddenLanguageName,
              })}
            </p>
          ) : null}
          {locked ? (
            <p className="mt-2 text-center text-xs leading-5 text-foreground/65 max-lg:text-white/80 lg:text-sm">
              {t("quiz.loadingDescription")}
            </p>
          ) : null}

          <div className="mt-6 flex min-h-0 flex-col items-center">
            <div className="w-full min-h-0 overflow-y-auto rounded-md border border-white/10 bg-black p-2 lg:h-[420px]">
              {languageStats.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {languageStats.map((language) => (
                    <button
                      key={language.code}
                      type="button"
                      disabled={locked}
                      aria-pressed={selectedLanguage === language.code}
                      onClick={() => onSelect(language.code)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md border border-black/10 bg-white p-3 text-left text-sm font-semibold text-black transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 lg:p-4 lg:text-base",
                        selectedLanguage === language.code &&
                          "border-black/40 bg-neutral-100",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-black">
                        <LanguageFlag code={language.code} />
                        <span className="truncate">
                          {getLanguageDisplayName(language.code, locale)}
                        </span>
                      </span>
                      <Badge className="border-transparent bg-black/10 text-black">
                        {formatCards(locale, language.count)}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center">
                  <div className="max-w-md">
                    <p className="text-base font-semibold text-foreground max-lg:text-white">
                      {t("quiz.noPracticeLanguagesTitle")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/70 max-lg:text-white/80">
                      {t("quiz.noPracticeLanguagesDescription")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {onBack ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="ghost"
                disabled={locked}
                className="text-foreground hover:bg-background-muted hover:text-foreground max-lg:text-white max-lg:hover:bg-white/10 max-lg:hover:text-white"
                onClick={onBack}
              >
                {t("common.back")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CountSelection({
  mode,
  language,
  availableCount,
  selectedCount,
  locked = false,
  onSelect,
}: {
  mode: PracticeMode;
  language: LanguageCode;
  availableCount: number;
  selectedCount: number | null;
  locked?: boolean;
  onSelect: (
    count: number,
    selection: {
      count: number;
      colorClass: string;
      contentScale: number;
      chestTiers?: ChestTier[];
    },
  ) => void;
  onBack?: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const showChestTiers = mode === "active";
  const languageName = getLanguageDisplayName(language, locale);
  const [launch, setLaunch] = useState<CountLaunch | null>(null);
  const [scatterMotion, setScatterMotion] = useState<Record<number, CountScatterMotion>>({});
  const launchTimerRef = useRef<number | null>(null);
  const scatterFrameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (launchTimerRef.current !== null) {
        window.clearTimeout(launchTimerRef.current);
      }
      if (scatterFrameRef.current !== null) {
        window.cancelAnimationFrame(scatterFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!launch) {
      setScatterMotion({});
      return;
    }

    const bodies = launch.scatter.map((item) => ({
      ...item,
      x: 0,
      y: 0,
      rotation: 0,
      velocityX: item.velocityX,
      velocityY: item.velocityY,
      rotationVelocity: item.rotationVelocity,
    }));
    let lastTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.032);
      lastTimestamp = timestamp;

      const nextMotion: Record<number, CountScatterMotion> = {};
      for (const body of bodies) {
        body.velocityY += 1850 * delta;
        body.velocityX *= 0.998;
        body.rotationVelocity *= 0.995;
        body.x += body.velocityX * delta;
        body.y += body.velocityY * delta;
        body.rotation += body.rotationVelocity * delta;

        if (body.y >= body.floorY) {
          body.y = body.floorY;
          body.velocityY *= -0.18;
          body.velocityX *= 0.86;
          body.rotationVelocity *= 0.82;
        }

        nextMotion[body.count] = {
          x: body.x,
          y: body.y,
          rotation: body.rotation,
        };
      }

      setScatterMotion(nextMotion);
      scatterFrameRef.current = window.requestAnimationFrame(tick);
    };

    scatterFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (scatterFrameRef.current !== null) {
        window.cancelAnimationFrame(scatterFrameRef.current);
      }
    };
  }, [launch]);

  function handleSelect(count: number, colorClass: string, button: HTMLButtonElement) {
    if (launch) return;

    const bounds = button.getBoundingClientRect();
    const scaleX = window.innerWidth / bounds.width;
    const scaleY = window.innerHeight / bounds.height;
    const contentScale = Math.min(scaleX, scaleY);
    const chestTiers = showChestTiers ? getChestPreviewPairForCount(count) : undefined;
    const targetX = window.innerWidth / 2 - (bounds.left + bounds.width / 2);
    const targetY = window.innerHeight / 2 - (bounds.top + bounds.height / 2);

    setLaunch({
      count,
      colorClass,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      scaleX,
      scaleY,
      // Keep the copy proportional while letting it grow with the cover.
      contentScale,
      contentScaleX: contentScale / scaleX,
      contentScaleY: contentScale / scaleY,
      chestTiers,
      targetX,
      targetY,
      scatter: QUIZ_COUNT_OPTIONS.map((option) => ({
        count: option,
        velocityX: (Math.random() < 0.5 ? -1 : 1) * (340 + Math.random() * 120),
        velocityY: -(620 + Math.random() * 120),
        rotationVelocity: (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 110),
        floorY: 180 + Math.random() * 85,
      })),
    });
    launchTimerRef.current = window.setTimeout(() => {
      onSelect(count, { count, colorClass, contentScale, chestTiers });
      launchTimerRef.current = null;
    }, 1180);
  }

  return (
    <div
      data-quiz-count-selection
      data-quiz-count-launching={launch ? "true" : undefined}
      className={cn(
        "animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background-card max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0",
        launch && "overflow-visible",
      )}
    >
      <div className="flex flex-col items-center justify-center bg-black px-5 py-4 text-center text-white max-lg:px-4 max-lg:py-3">
        <h2 className="text-base font-semibold sm:text-lg">
          {t("quiz.chooseCountTitle")}
        </h2>
        <p className="text-xs font-medium opacity-90 sm:text-sm">
          {t("quiz.countAvailable", {
            language: languageName,
            count: availableCount,
          })}
        </p>
        {locked ? (
          <p className="mt-2 text-xs font-medium opacity-90 sm:text-sm">
            {t("quiz.loadingDescription")}
          </p>
        ) : null}
      </div>

      <div className="grid flex-1 grid-cols-2">
        {QUIZ_COUNT_OPTIONS.map((count) => {
          const disabled = locked || Boolean(launch) || count > availableCount;
          const previewPair = showChestTiers
            ? getChestPreviewPairForCount(count)
            : undefined;
          const colorClass = getQuizCountButtonColor(count);

          return (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={(event) => handleSelect(count, colorClass, event.currentTarget)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 border border-white/10 p-4 text-center text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40",
                colorClass,
                selectedCount === count &&
                  "ring-inset ring-2 ring-white/30 brightness-110",
                launch && launch.count !== count && "relative z-[80] pointer-events-none disabled:opacity-100",
                launch && launch.count === count && "opacity-0",
              )}
              style={
                launch && launch.count !== count
                  ? ({
                      transform: `translate3d(${scatterMotion[count]?.x ?? 0}px, ${scatterMotion[count]?.y ?? 0}px, 0) rotate(${scatterMotion[count]?.rotation ?? 0}deg)`,
                      transformOrigin: "50% 70%",
                      willChange: "transform",
                    } as CSSProperties)
                  : undefined
              }
            >
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t("quiz.countLabel")}
              </span>
              <span className="text-4xl font-bold sm:text-5xl">{count}</span>
              {showChestTiers && previewPair ? (
                <div className="mt-1 flex flex-col items-center gap-1">
                  {previewPair.map((tier) => (
                    <span
                      key={tier}
                      className="flex items-center gap-1 text-xs font-semibold"
                    >
                      <ChestIcon tier={tier} className="size-4 shrink-0" />
                      {t(getChestLabelKey(tier))}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {launch
        ? createPortal(
            <div
              aria-hidden="true"
              className={cn("pointer-events-none fixed z-[70] flex flex-col items-center justify-center gap-1 border border-white/10 text-center text-white animate-quiz-count-cover", launch.colorClass)}
              style={{
                left: launch.left,
                top: launch.top,
                width: launch.width,
                height: launch.height,
                "--quiz-count-cover-x": `${launch.targetX}px`,
                "--quiz-count-cover-y": `${launch.targetY}px`,
                "--quiz-count-cover-scale-x": launch.scaleX,
                "--quiz-count-cover-scale-y": launch.scaleY,
                "--quiz-count-cover-content-scale-x": launch.contentScaleX,
                "--quiz-count-cover-content-scale-y": launch.contentScaleY,
              } as CSSProperties}
            >
              <div className="animate-quiz-count-cover-copy flex flex-col items-center justify-center gap-1">
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">{t("quiz.countLabel")}</span>
                <span className="text-4xl font-bold sm:text-5xl">{launch.count}</span>
                {launch.chestTiers ? (
                  <div className="mt-1 flex flex-col items-center gap-1">
                    {launch.chestTiers.map((tier) => (
                      <span key={tier} className="flex items-center gap-1 text-xs font-semibold">
                        <ChestIcon tier={tier} className="size-4 shrink-0" />
                        {t(getChestLabelKey(tier))}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type CountLaunch = {
  count: number;
  colorClass: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  contentScale: number;
  contentScaleX: number;
  contentScaleY: number;
  chestTiers?: ChestTier[];
  targetX: number;
  targetY: number;
  scatter: Array<{
    count: number;
    velocityX: number;
    velocityY: number;
    rotationVelocity: number;
    floorY: number;
  }>;
};

type CountScatterMotion = {
  x: number;
  y: number;
  rotation: number;
};

function QuizProgressHeader({
  mode,
  item,
}: {
  mode: PracticeMode;
  item: QuizItem;
}) {
  const t = useT();
  const { locale } = useLocale();
  const style = TIER_STYLES[item.card.tier];
  const bonusCopy = getBonusCopy(locale);
  const bonusLabel = item.isBonus
    ? item.bonusQuestion.kind === "matching"
      ? `${bonusCopy.intro} · ${bonusCopy.matchingTitle}`
      : item.bonusQuestion.kind === "sentence-order"
        ? `${bonusCopy.intro} · ${bonusCopy.sentenceTitle}`
        : item.bonusQuestion.kind === "category-sort"
          ? `${bonusCopy.intro} · ${bonusCopy.categoryTitle}`
          : `${bonusCopy.intro} · ${bonusCopy.imposterTitle}`
    : null;

  return (
    <div className="rounded-lg border border-transparent bg-transparent p-3 max-sm:p-2 sm:p-5 max-lg:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {bonusLabel ?? (item.questionType === "text"
            ? t("quiz.learningQuizBadge")
            : item.questionType === "definition"
              ? t("quiz.definitionBadge")
            : item.questionType === "sentence-completion"
              ? t("quiz.sentenceCompletionBadge")
              : item.questionType === "listening"
                ? t("quiz.listeningBadge")
                : item.questionType === "true-false"
                  ? t("games.wordChallenge.title")
                  : mode === "learned"
                    ? t("quiz.reviewBadge")
                    : t("quiz.activeBadgeWithTier", { tier: item.card.tier }))}
        </Badge>
      </div>
    </div>
  );
}

function MobileQuizTopBar({
  currentIndex,
  total,
  totalPoints,
  scorePulse,
  onExit,
}: {
  currentIndex: number;
  total: number;
  totalPoints: number;
  scorePulse: number;
  onExit: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const quizProgress = Math.min(100, ((currentIndex + 1) / total) * 100);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex h-16 items-center gap-3 bg-black px-4 text-white lg:hidden"
      data-mobile-quiz-top-bar
    >
      <button
        type="button"
        onClick={onExit}
        aria-label={t("quiz.exit")}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X className="size-6" aria-hidden="true" />
      </button>

      <div
        className="min-w-0 flex-1"
        role="progressbar"
        aria-label={`${currentIndex + 1} / ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
        data-quiz-session-progress
      >
        <Progress
          value={quizProgress}
          className="h-3.5 rounded-full bg-white/15"
          indicatorClassName="bg-gradient-to-r from-[var(--rank-start)] via-[var(--premium-start)] to-[var(--rank-end)] transition-[width] duration-300 ease-out"
        />
      </div>

      <div
        className="inline-flex shrink-0 items-center gap-1.5"
        aria-label={formatPoints(locale, totalPoints)}
        data-quiz-total-score
      >
        <ScoreIcon size={22} className="size-[22px]" />
        <span className={cn("bg-gradient-to-r from-[var(--score-highlight)] via-[var(--score-highlight)] to-[var(--score-end)] bg-clip-text text-base font-bold text-transparent", scorePulse > 0 && "animate-score-bobble")} key={scorePulse}>
          {formatNumber(locale, totalPoints)}
        </span>
      </div>
    </div>
  );
}

function QuizCounter({
  currentIndex,
  total,
}: {
  currentIndex: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xl font-bold text-foreground max-lg:hidden">
        {currentIndex + 1} / {total}
      </span>
    </div>
  );
}

function QuizRerollButton({
  action,
  hidden = false,
  className,
}: {
  action: QuizRerollAction;
  hidden?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={action.onReroll}
      disabled={action.disabled || hidden}
      className={cn(
        "quiz-action-scale inline-flex h-10 min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#22c987] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-[transform,filter] duration-200 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
        className,
      )}
      aria-label={t("quiz.rerollQuestion")}
      data-quiz-action-hidden={hidden}
      data-quiz-reroll
    >
      {action.loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
      <span className="min-w-0">{t("quiz.rerollQuestion")}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5">
        {GEM_COSTS.rerollQuestion.amount}
        <Image src={GEM_ASSETS.green} alt="" width={18} height={18} className="size-[18px] object-contain" />
      </span>
    </button>
  );
}

function QuizQuestionActionRow({
  onSkip,
  skipDisabled,
  rerollAction,
  hidden = false,
  className,
}: {
  onSkip: () => void;
  skipDisabled: boolean;
  rerollAction?: QuizRerollAction;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-1 flex w-full gap-2 sm:mt-2", className)} data-quiz-question-actions data-quiz-reroll-action>
      <QuizSkipButton
        className="min-w-0 flex-1"
        disabled={skipDisabled || hidden}
        hidden={hidden}
        onClick={onSkip}
      />
      {rerollAction ? <QuizRerollButton action={rerollAction} hidden={hidden} /> : null}
    </div>
  );
}

function ListeningQuestion({
  item,
  showingAnswer,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: ListeningQuizItem;
  showingAnswer: boolean;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const { pronunciation, isLoading } = useCardPronunciation(item.card);

  useEffect(() => {
    speakCardTerm(item.card.term, item.card.language);
  }, [item.card.id, item.card.language, item.card.term]);

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
      data-quiz-question-content="listening"
    >
      <p className="text-center text-sm font-semibold text-foreground-muted max-lg:text-white">
        {t("quiz.listeningPrompt")}
      </p>

      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border bg-background-card px-4 py-5 text-center sm:px-6 sm:py-6">
        <button
          type="button"
          onClick={() => speakCardTerm(item.card.term, item.card.language)}
          className="inline-flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-95"
          aria-label={t("quiz.listeningAgain")}
          title={t("quiz.listeningAgain")}
        >
          <Volume2 className="size-7" aria-hidden="true" />
        </button>
        <div className="flex min-h-8 items-center justify-center gap-2">
          <span
            className="text-xl font-semibold text-foreground max-lg:text-white sm:text-2xl"
            data-quiz-listening-pronunciation
          >
            {pronunciation || "..."}
          </span>
          {isLoading ? (
            <Loader2
              className="size-4 animate-spin text-foreground-muted max-lg:text-white/70"
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {item.question.options.map((option, index) => {
          const isCorrectOption = option === item.question.correctAnswer;
          const optionColor = CHOICE_OPTION_COLORS[index % CHOICE_OPTION_COLORS.length];

          return (
            <QuizAnswerButton
              key={option}
              type="button"
              data-quiz-listening-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              interactive={!showingAnswer}
              baseClassName={optionColor}
              feedbackState={showingAnswer ? (isCorrectOption ? "correct" : "incorrect") : "idle"}
              incorrectOverlayClassName="bg-red-950"
              className="min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-base font-semibold disabled:cursor-default sm:min-h-[5.25rem]"
            >
              {option}
            </QuizAnswerButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
        hidden={showingAnswer}
        onSkip={onSkip}
      />

      <div className="mt-1 min-h-10 sm:mt-2" data-quiz-next-slot>
        <Button
          className={cn(
            "w-full bg-brand hover:bg-brand-hover max-lg:hidden",
            (!showingAnswer || !showNextButton) && "invisible pointer-events-none",
          )}
          data-quiz-next-button
          disabled={!showingAnswer || !showNextButton}
          onClick={onNext}
        >
          {t("quiz.nextCard")}
        </Button>
      </div>
    </div>
  );
}

function ChoiceQuestion({
  item,
  showingAnswer,
  showPrompt = true,
  promptClassName,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: ChoiceQuizItem;
  showingAnswer: boolean;
  showPrompt?: boolean;
  promptClassName?: string;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const question = item.question;

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
      data-quiz-question-content="choice"
    >
      {showPrompt ? (
        <p
          className={cn(
            "text-center text-sm font-semibold text-foreground-muted max-lg:text-white",
            promptClassName,
          )}
        >
          {t("quiz.recallPrompt")}
        </p>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => speakCardTerm(item.card.term, item.card.language)}
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-sm:size-8"
          aria-label={`${item.card.term} ${t("cards.speak")}`}
          title={t("cards.speak")}
        >
          <Volume2 className="size-5 max-sm:size-4" aria-hidden="true" />
        </button>
        <h2 className="font-display text-3xl font-semibold leading-none text-foreground max-lg:text-white sm:text-4xl lg:text-6xl">
          {item.card.term}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {question.options.map((option, index) => {
          const isCorrectOption = option === question.correctAnswer;
          const optionColor =
            CHOICE_OPTION_COLORS[index % CHOICE_OPTION_COLORS.length];

          return (
            <QuizAnswerButton
              key={option}
              type="button"
              data-quiz-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              interactive={!showingAnswer}
              baseClassName={optionColor}
              feedbackState={showingAnswer ? (isCorrectOption ? "correct" : "incorrect") : "idle"}
              incorrectOverlayClassName="bg-red-950"
              className={cn(
                "min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-base font-semibold disabled:cursor-default sm:min-h-[5.25rem] lg:min-h-20 lg:py-3 lg:text-base",
              )}
            >
              {option}
            </QuizAnswerButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
        hidden={showingAnswer}
        onSkip={onSkip}
      />

      <div className="mt-1 min-h-10 sm:mt-2" data-quiz-next-slot>
        <Button
          className={cn(
            "w-full bg-brand hover:bg-brand-hover max-lg:hidden",
            (!showingAnswer || !showNextButton) && "invisible pointer-events-none",
          )}
          data-quiz-next-button
          disabled={!showingAnswer || !showNextButton}
          onClick={onNext}
        >
          {t("quiz.nextCard")}
        </Button>
      </div>
    </div>
  );
}

function DefinitionQuestion({
  item,
  showingAnswer,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: DefinitionQuizItem;
  showingAnswer: boolean;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const question = item.question;

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
      data-quiz-question-content="definition"
    >
      <p className="text-center text-sm font-semibold text-foreground-muted max-lg:text-white">
        {t("quiz.definitionPrompt")}
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => speakCardTerm(item.card.term, item.card.language)}
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-sm:size-8"
          aria-label={`${item.card.term} ${t("cards.speak")}`}
          title={t("cards.speak")}
        >
          <Volume2 className="size-5 max-sm:size-4" aria-hidden="true" />
        </button>
        <h2 className="font-display text-3xl font-semibold leading-none text-foreground max-lg:text-white sm:text-4xl lg:text-6xl">
          {item.card.term}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {question.options.map((option, index) => {
          const isCorrectOption = option === question.correctAnswer;
          const optionColor = CHOICE_OPTION_COLORS[index % CHOICE_OPTION_COLORS.length];

          return (
            <QuizAnswerButton
              key={option}
              type="button"
              data-quiz-definition-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              interactive={!showingAnswer}
              baseClassName={optionColor}
              feedbackState={showingAnswer ? (isCorrectOption ? "correct" : "incorrect") : "idle"}
              incorrectOverlayClassName="bg-red-950"
              className="min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-sm font-semibold disabled:cursor-default sm:min-h-[5.25rem] sm:text-base"
            >
              {option}
            </QuizAnswerButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
        hidden={showingAnswer}
        onSkip={onSkip}
      />

      <div className="mt-1 min-h-10 sm:mt-2" data-quiz-next-slot>
        <Button
          className={cn(
            "w-full bg-brand hover:bg-brand-hover max-lg:hidden",
            (!showingAnswer || !showNextButton) && "invisible pointer-events-none",
          )}
          data-quiz-next-button
          disabled={!showingAnswer || !showNextButton}
          onClick={onNext}
        >
          {t("quiz.nextCard")}
        </Button>
      </div>
    </div>
  );
}

function QuizAnswerButton({
  baseClassName,
  feedbackState = "idle",
  interactive = true,
  incorrectOverlayClassName = "bg-background-inverse",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  baseClassName: string;
  feedbackState?: QuizAnswerFeedbackState;
  interactive?: boolean;
  incorrectOverlayClassName?: string;
}) {
  return (
    <button
      className={cn(
        "group relative flex overflow-hidden rounded-md text-white transition-[background-color,color,transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none",
        baseClassName,
        interactive &&
          "hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.7)] active:translate-y-0 active:scale-[0.99]",
        feedbackState === "correct" && "shadow-[0_16px_34px_-22px_rgba(16,185,129,0.7)]",
        feedbackState === "incorrect" &&
          "shadow-[0_12px_26px_-22px_rgba(69,10,10,0.78)]",
        className,
      )}
      data-quiz-answer-feedback={feedbackState}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 ease-out",
          interactive && "group-hover:opacity-100",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          feedbackState === "correct" && "bg-emerald-500 opacity-100",
          feedbackState === "incorrect" && incorrectOverlayClassName,
          feedbackState === "incorrect" && "opacity-100",
        )}
      />
      <span className="relative z-10 w-full">{children}</span>
    </button>
  );
}

function SentenceCompletionQuestion({
  item,
  showingAnswer,
  isAiValidating,
  aiValidatingAnswer,
  selectedAnswer,
  answerAccepted,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
  mobileCard,
}: {
  item: SentenceCompletionQuizItem;
  showingAnswer: boolean;
  isAiValidating: boolean;
  aiValidatingAnswer: string | null;
  selectedAnswer: string | null;
  answerAccepted: boolean | null;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
  mobileCard?: ReactNode;
}) {
  const t = useT();
  const { question, character } = item;
  const characterName = getCharacterName(character, item.card.language);

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 max-lg:translate-y-3 lg:gap-4 lg:p-8"
      data-quiz-question-content="sentence-completion"
    >
      <p className="text-center text-sm font-semibold text-foreground-muted max-lg:text-white">
        {t("quiz.sentenceCompletionPrompt")}
      </p>

      <div className="flex items-start gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-border bg-background-muted sm:size-14">
          <Image
            src={character.imageSrc}
            alt={characterName}
            fill
            sizes="56px"
            className="origin-top scale-[2] object-cover object-top"
          />
        </div>
        <div className="relative min-h-20 flex-1 rounded-lg bg-background-card px-4 py-3 text-left before:absolute before:-left-1.5 before:top-5 before:size-3 before:rotate-45 before:bg-background-card">
          <p className="relative text-xs font-semibold text-foreground-muted max-lg:text-white/80">{characterName}</p>
          <p
            className="relative mt-1 text-lg font-semibold leading-relaxed text-foreground max-lg:text-white sm:text-xl"
            data-quiz-sentence
          >
            {question.sentenceWithBlank}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {question.options.map((option, index) => {
          const isCorrectOption = option === question.correctAnswer;
          const optionColor =
            SENTENCE_COMPLETION_OPTION_COLORS[index % SENTENCE_COMPLETION_OPTION_COLORS.length];
          const isSelectedOption = option === selectedAnswer;
          const isValidatingOption = isAiValidating && option === aiValidatingAnswer;
          const feedbackState = !showingAnswer
            ? "idle"
            : isSelectedOption
              ? answerAccepted
                ? "correct"
                : "incorrect"
              : !answerAccepted && isCorrectOption
                ? "correct"
                : "idle";
          const answerStateColor = showingAnswer ? "bg-background-card" : optionColor;

          return (
            <QuizAnswerButton
              key={option}
              type="button"
              data-quiz-sentence-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer || isAiValidating}
              interactive={!showingAnswer && !isAiValidating}
              baseClassName={answerStateColor}
              feedbackState={feedbackState}
              incorrectOverlayClassName="bg-red-500"
              className={cn(
                "min-h-14 items-center justify-center px-2 py-2 text-center text-sm font-semibold sm:min-h-16 sm:px-3 sm:text-base",
                showingAnswer && feedbackState === "idle" && "text-foreground",
              )}
            >
              {isValidatingOption ? (
                <Loader2
                  className="size-5 animate-spin"
                  data-quiz-sentence-option-loading
                  aria-label={t("quiz.aiValidating")}
                />
              ) : (
                option
              )}
            </QuizAnswerButton>
          );
        })}
      </div>

      {mobileCard ? <div className="-my-1 flex items-center justify-center lg:hidden">{mobileCard}</div> : null}

      <QuizQuestionActionRow
        skipDisabled={showingAnswer || isAiValidating}
        rerollAction={rerollAction}
        hidden={showingAnswer}
        onSkip={onSkip}
        className="max-lg:-mt-1"
      />

      <div className="mt-1 min-h-10 sm:mt-2" data-quiz-next-slot>
        <Button
          className={cn(
            "w-full bg-brand hover:bg-brand-hover max-lg:hidden",
            (!showingAnswer || !showNextButton) && "invisible pointer-events-none",
          )}
          data-quiz-next-button
          disabled={!showingAnswer || !showNextButton}
          onClick={onNext}
        >
          {t("quiz.nextCard")}
        </Button>
      </div>
    </div>
  );
}

function TrueFalseQuestion({
  item,
  showingAnswer,
  showPrompt = true,
  promptClassName,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: TrueFalseQuizItem;
  showingAnswer: boolean;
  showPrompt?: boolean;
  promptClassName?: string;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const question = item.question;
  const options = [
    {
      value: "true" as const,
      label: t("games.wordChallenge.correct"),
      isCorrect: question.correctAnswer === "true",
      baseClassName: "bg-blue-500",
    },
    {
      value: "false" as const,
      label: t("games.wordChallenge.wrong"),
      isCorrect: question.correctAnswer === "false",
      baseClassName: "bg-red-500",
    },
  ];

  return (
    <div
      className="animate-screen-pop flex w-full flex-col items-center gap-3 rounded-lg border border-transparent bg-transparent p-0 text-center lg:gap-4 lg:p-8"
      data-quiz-question-content="true-false"
    >
      {showPrompt ? (
        <p
          className={cn(
            "text-center text-sm font-semibold text-foreground-muted max-lg:text-white",
            promptClassName,
          )}
        >
          {t("games.wordChallenge.title")}
        </p>
      ) : null}

      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <p className="text-sm font-semibold text-foreground-muted max-lg:text-white">
          {t("games.wordChallenge.question")}
        </p>
        <div className="flex w-full items-center justify-center rounded-lg border border-border bg-background-card px-4 py-5 sm:px-5 sm:py-6">
          <p
            className="text-center text-2xl font-semibold leading-snug text-foreground max-lg:text-white sm:text-3xl lg:text-4xl"
            data-quiz-true-false-meaning
          >
            {`${item.card.term} = ${question.proposedMeaning}`}
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:gap-3">
        {options.map((option) => (
          <QuizAnswerButton
            key={option.value}
            type="button"
            data-quiz-true-false-option={option.value}
            onClick={() => onAnswer(option.value, option.isCorrect)}
            disabled={showingAnswer}
            interactive={!showingAnswer}
            baseClassName={option.baseClassName}
            feedbackState={showingAnswer ? (option.isCorrect ? "correct" : "incorrect") : "idle"}
            incorrectOverlayClassName="bg-red-950"
            className={cn(
              "min-h-[4.5rem] items-center justify-center px-3 py-2 text-base font-semibold sm:min-h-[5.25rem] lg:min-h-20 lg:py-3",
            )}
          >
            {option.label}
          </QuizAnswerButton>
        ))}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
        hidden={showingAnswer}
        onSkip={onSkip}
      />

      <div className="mt-1 flex min-h-10 w-full items-start justify-center sm:mt-2" data-quiz-next-slot>
        {showingAnswer ? (
          <div className="hidden w-full space-y-3 lg:block lg:mt-2">
            <div className="flex items-center justify-center gap-3">
              {question.correctAnswer === "true" ? (
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="size-5 text-rose-600" aria-hidden="true" />
              )}
              <p className="font-semibold text-foreground">
                {t("quiz.correctAnswerWithValue", {
                  answer: question.actualMeaning,
                })}
              </p>
            </div>
            <Button
              className={cn(
                "w-full bg-brand hover:bg-brand-hover",
                !showNextButton && "invisible pointer-events-none",
              )}
              data-quiz-next-button
              onClick={onNext}
              disabled={!showNextButton}
            >
              {t("quiz.nextCard")}
            </Button>
          </div>
        ) : (
          <Button
            className="invisible hidden w-full pointer-events-none bg-brand hover:bg-brand-hover lg:block"
            data-quiz-next-button
            disabled
          >
            {t("quiz.nextCard")}
          </Button>
        )}
      </div>
    </div>
  );
}

function TextQuestion({
  item,
  textAnswer,
  textResult,
  showingAnswer,
  isAiValidating,
  onChange,
  onSubmitText,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
  isFirstQuestion = false,
}: {
  item: TextQuizItem;
  textAnswer: string;
  textResult: "idle" | "correct" | "incorrect";
  showingAnswer: boolean;
  isAiValidating: boolean;
  onChange: (value: string) => void;
  onSubmitText: (answer: string) => Promise<void>;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
  isFirstQuestion?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question;
  const isMobileViewport = useSyncExternalStore(
    (callback) => {
      window.addEventListener("resize", callback);
      return () => window.removeEventListener("resize", callback);
    },
    () => window.innerWidth < 1024,
    () => false,
  );
  const [splashDone, setSplashDone] = useState(false);
  const [splashColor] = useState(
    () =>
      CHOICE_OPTION_COLORS[
        Math.floor(Math.random() * CHOICE_OPTION_COLORS.length)
      ],
  );

  const skipSplash = isFirstQuestion;

  useEffect(() => {
    if (!isMobileViewport || skipSplash) {
      setSplashDone(true);
      return;
    }
    const timer = window.setTimeout(() => setSplashDone(true), 1200);
    return () => window.clearTimeout(timer);
  }, [isMobileViewport, skipSplash]);

  async function handleSubmit() {
    if (showingAnswer || isAiValidating) return;
    await onSubmitText(textAnswer);
  }

  return (
    <>
      {!skipSplash && isMobileViewport && !splashDone
        ? createPortal(
            <div
              className={cn(
                "pointer-events-none fixed inset-0 z-[60] flex items-center justify-center animate-learning-quiz-splash lg:hidden",
                splashColor,
              )}
              data-learning-quiz-splash
              aria-hidden="true"
            >
              <span className="px-6 text-center text-3xl font-bold text-white sm:text-4xl">
                {t("quiz.learningQuizSplash")}
              </span>
            </div>,
            document.body,
          )
        : null}
      <div
        className={cn(
          "animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8",
          splashDone || !isMobileViewport ? "opacity-100" : "opacity-0",
        )}
        data-quiz-question-content="text"
      >
        <p className="text-center text-sm font-semibold text-[var(--accent-primary)] max-lg:text-white">
          {t("quiz.learningPrompt")}
        </p>
        <div className="flex items-center justify-center">
          <h2 className="font-display text-3xl font-semibold leading-none text-foreground max-lg:text-white sm:text-4xl lg:text-6xl">
            {getCardTranslation(item.card, locale)}
          </h2>
        </div>

        <div>
          <input
            type="text"
            value={textAnswer}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !showingAnswer && !isAiValidating) {
                handleSubmit();
              }
            }}
            disabled={showingAnswer || isAiValidating}
            placeholder={t("quiz.learningQuizPlaceholder")}
            className={cn(
              "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-foreground-muted focus:border-foreground sm:py-3",
              showingAnswer &&
                textResult === "correct" &&
                "border-emerald-500",
              showingAnswer &&
                textResult === "incorrect" &&
                "border-rose-500",
            )}
          />

          {showingAnswer ? (
            <div className="mt-2 space-y-3 max-lg:hidden lg:mt-4">
              <div className="flex items-center gap-3">
                {textResult === "correct" ? (
                  <CheckCircle2
                    className="size-5 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="size-5 text-rose-600"
                    aria-hidden="true"
                  />
                )}
                <p className="font-semibold text-foreground">
                  {textResult === "correct"
                    ? t("quiz.correctAnswer")
                    : t("quiz.correctAnswerWithValue", {
                        answer: question.correctAnswer,
                      })}
                </p>
              </div>
              <Button
                className={cn(
                  "w-full bg-brand hover:bg-brand-hover",
                  !showNextButton && "invisible pointer-events-none",
                )}
                onClick={onNext}
                disabled={!showNextButton}
              >
                {t("quiz.nextCard")}
              </Button>
            </div>
          ) : null}

          <div
            className={cn(
              "mt-4 flex w-full flex-col gap-2 sm:mt-4 lg:mt-5",
              showingAnswer && "pointer-events-none",
            )}
            data-quiz-question-actions
            data-quiz-reroll-action
          >
            <Button
              className="quiz-action-scale w-full"
              data-quiz-action-hidden={showingAnswer}
              onClick={handleSubmit}
              disabled={textAnswer.trim().length === 0 || isAiValidating || showingAnswer}
            >
              {isAiValidating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  {t("quiz.aiValidating")}
                </>
              ) : (
                t("quiz.submitAnswer")
              )}
            </Button>
            <div className="flex w-full gap-2">
              <QuizSkipButton
                className="min-w-0 flex-[0.8]"
                disabled={isAiValidating}
                hidden={showingAnswer}
                onClick={onSkip}
              />
              {rerollAction ? (
                <QuizRerollButton
                  action={rerollAction}
                  className="flex-[1.2]"
                  hidden={showingAnswer}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function MobileQuizFeedback({
  isOpen,
  isCorrect,
  correctAnswer,
  onNext,
  showNextButton = true,
}: {
  isOpen: boolean;
  isCorrect: boolean;
  correctAnswer?: string;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const [snapshot, setSnapshot] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSnapshot({ isCorrect, correctAnswer: correctAnswer ?? "" });
    }
  }, [isOpen, isCorrect, correctAnswer]);

  const display = snapshot ?? { isCorrect, correctAnswer: correctAnswer ?? "" };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col justify-end transition-opacity duration-300 max-lg:flex lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      data-quiz-mobile-feedback
    >
      <div
        className={cn(
          "relative flex w-full items-center justify-between gap-4 rounded-t-2xl p-4 shadow-2xl transition-transform duration-300",
          display.isCorrect ? "bg-emerald-500" : "bg-rose-500",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-3">
          {display.isCorrect ? (
            <CheckCircle2 className="size-6 text-white" aria-hidden="true" />
          ) : (
            <XCircle className="size-6 text-white" aria-hidden="true" />
          )}
          <p className="text-sm font-semibold text-white">
            {display.isCorrect
              ? t("quiz.correctAnswer")
              : display.correctAnswer
                ? t("quiz.correctAnswerWithValue", { answer: display.correctAnswer })
                : t("quiz.wrongAnswer")}
          </p>
        </div>
        <Button
          className={cn(
            "shrink-0 bg-white text-black hover:bg-white/90",
            !showNextButton && "invisible pointer-events-none",
          )}
          onClick={onNext}
          data-quiz-mobile-feedback-next
          disabled={!showNextButton}
        >
          {t("quiz.nextCard")}
        </Button>
      </div>
    </div>
  );
}

export function CelebrationView({
  card,
  basePoints,
  onContinue,
}: {
  card: VocabularyCard;
  basePoints: number;
  onContinue: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { refreshStats } = useProgressStats();
  const [cardFace, setCardFace] = useState<"front" | "back">("back");
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<ScoreFlightIcon[]>([]);
  const hasTriggered = useRef(false);
  const hasStartedPointFlight = useRef(false);
  const onContinueRef = useRef(onContinue);
  const closeTimerRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const arrivalTimersRef = useRef<number[]>([]);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const gainedPoints = getPointsForTier(card.tier);

  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    setCardFace("front");
    vibrate("learned");
    playSoundEffect("confetti");
    vibrate("confetti");
    void confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"],
      disableForReducedMotion: true,
    });
  }, []);

  useLayoutEffect(() => {
    if (hasStartedPointFlight.current) return;

    startTimerRef.current = window.setTimeout(() => {
      if (hasStartedPointFlight.current) return;
      if (!cardRef.current || !scoreRef.current) return;

      hasStartedPointFlight.current = true;

      const cardBounds = cardRef.current.getBoundingClientRect();
      const scoreBounds = scoreRef.current.getBoundingClientRect();
      const targetX = scoreBounds.left + scoreBounds.width / 2;
      const targetY = scoreBounds.top + scoreBounds.height / 2;
      const iconCount = getScoreFlightIconCount(gainedPoints);
      const flightDuration = 700;
      const latestStart = 780;
      const nextIcons = Array.from({ length: iconCount }, (_, index) => {
        const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
        const startX = cardBounds.left + cardBounds.width * (0.22 + Math.random() * 0.56);
        const startY = cardBounds.top + cardBounds.height * (0.24 + Math.random() * 0.52);

        return {
          id: index,
          startX,
          startY,
          scatterX: (Math.random() - 0.5) * 150,
          scatterY: -35 - Math.random() * 100,
          targetX,
          targetY,
          delay: Math.round(ratio * latestStart),
        };
      });

      setFlightIcons(nextIcons);
      arrivalTimersRef.current = nextIcons.map((icon, index) => window.setTimeout(() => {
        setDisplayPoints(
          basePoints + getScoreFlightAwardAtArrival(gainedPoints, iconCount, index + 1),
        );
        setScorePulse(index + 1);
        playSoundEffect("points");
        vibrate("tap");

        if (index === nextIcons.length - 1) {
          void refreshStats();
          closeTimerRef.current = window.setTimeout(() => onContinueRef.current(), 420);
        }
      }, icon.delay + flightDuration));
    }, 1000);

    return () => {
      if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [basePoints, gainedPoints, refreshStats]);

  return (
    <div
      className="animate-screen-pop fixed inset-0 z-40 overflow-hidden bg-background px-4 py-6 text-center sm:px-6 sm:py-8"
      data-quiz-celebration
      data-quiz-celebration-stage="score-flight"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="relative flex h-full w-full max-w-5xl flex-1 flex-col">
          <div
            className="flex justify-center pt-1 sm:pt-2"
          >
            <div
              className="relative flex items-center gap-2 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-white shadow-lg"
              data-quiz-celebration-score
            >
              <Star className="size-5 fill-current" aria-hidden="true" />
              <span
                className={cn(
                  "text-lg font-bold",
                  scorePulse > 0 && "animate-score-bobble",
                )}
                key={scorePulse}
                ref={scoreRef}
              >
                {formatPoints(locale, displayPoints)}
              </span>
            </div>
            <RewardGemHud className="mt-2" animate />
          </div>

          <div className="flex flex-1 items-center justify-center py-10 sm:py-12">
            <div
                className="flex w-full max-w-2xl flex-col items-center bg-transparent px-6 py-8 sm:px-8 sm:py-10"
              data-quiz-celebration-content
            >
              <h2 className="text-2xl font-semibold text-foreground">
                {t("quiz.learnedTitle")}
              </h2>

                <div
                  ref={cardRef}
                className="mt-5 w-[min(260px,68vw)] max-w-full sm:w-[min(292px,76vw)]"
                data-quiz-celebration-card
              >
                <VocabularyCardView
                  card={card}
                  owned
                  initialFace="back"
                  face={cardFace}
                  flippable={false}
                  className="h-auto w-full min-h-0 max-sm:aspect-[3/4] max-sm:min-h-0"
                />
              </div>

            </div>
          </div>
        </div>
      </div>
      {flightIcons.length > 0
        ? createPortal(
            flightIcons.map((icon) => (
              <span
                key={icon.id}
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-50 animate-quiz-score-icon-flight"
                style={{
                  "--score-flight-start-x": `${icon.startX}px`,
                  "--score-flight-start-y": `${icon.startY}px`,
                  "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`,
                  "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
                  "--score-flight-target-x": `${icon.targetX}px`,
                  "--score-flight-target-y": `${icon.targetY}px`,
                  animationDelay: `${icon.delay}ms`,
                } as CSSProperties}
              >
                <ScoreIcon size={32} />
              </span>
            )),
            document.body,
          )
        : null}
    </div>
  );
}

type ScoreFlightIcon = {
  id: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function QuizViewportOverlay({
  children,
  className,
  overlay,
  learnPagePhase,
}: {
  children: ReactNode;
  className: string;
  overlay: "result" | "chest";
  learnPagePhase?: "result";
}) {
  const mounted = useIsMounted();

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      data-quiz-overlay={overlay}
      data-learn-quiz-page={learnPagePhase}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}

export function ResultView({
  mode,
  results,
  selectedCount,
  chestOpened,
  quizSessionId,
  streakRewardStreak = 0,
  streakRewardPoints = 0,
  locked,
  onRestart,
  onExit,
}: {
  mode: PracticeMode;
  results: QuizResult;
  selectedCount: number | null;
  chestOpened: boolean;
  quizSessionId?: string;
  streakRewardStreak?: number;
  streakRewardPoints?: number;
  locked?: boolean;
  onRestart: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const session = useOptionalAuthSession();
  const user = session?.user ?? null;
  const refreshProfile = session?.refreshProfile;
  const updateProfileField = session?.updateProfileField;
  const { stats, refreshStats } = useProgressStats();
  const { openLeaderboard } = useLeaderboardOverlay();
  const router = useRouter();
  const { data: leaderboardData } = useLeaderboardData({ refreshOnMount: true });
  const [openMenu, setOpenMenu] = useState<
    "correct" | "incorrect" | "learned" | null
  >(null);
  const hasTriggeredResult = useRef(false);
  const resultRewardPromiseRef = useRef<ReturnType<typeof awardQuizResultPoints> | null>(null);
  const resultGemRewardStartedRef = useRef(false);
  const resultBasePointsRef = useRef(stats.totalPoints);
  const starSourceRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const flightStartedRef = useRef(false);
  const flightIconCountRef = useRef(0);
  const arrivedFlightIconsRef = useRef(new Set<number>());
  const arrivalTimersRef = useRef<number[]>([]);
  const handleResultPointFlightEndRef = useRef<(iconId: number) => void>(() => {});
  const [displayPoints, setDisplayPoints] = useState(stats.totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<ScoreFlightIcon[]>([]);
  const [starsRevealedAt, setStarsRevealedAt] = useState<number | null>(null);
  const [resultRewardAwarded, setResultRewardAwarded] = useState(false);
  const [resultGemRewards, setResultGemRewards] = useState<GemRewards>([]);
  const resultGemFinalBalancesRef = useRef<GemBalances | null>(null);
  const {
    balances: resultGemDisplayBalances,
    pulse: resultGemPulse,
    prepare: prepareResultGemDisplay,
    handleGemArrive: handleResultGemArrive,
    finish: finishResultGemDisplay,
  } = useGemRewardDisplay();
  const performance = getQuizPerformanceSummary(
    mode,
    results,
    selectedCount,
    chestOpened,
  );
  const starRating = useMemo(() => {
    const accuracy = performance.accuracy;
    if (accuracy >= 90) return 5;
    if (accuracy >= 75) return 4;
    if (accuracy >= 60) return 3;
    if (accuracy >= 40) return 2;
    return 1;
  }, [performance.accuracy]);
  const resultCardCount = selectedCount ?? 10;
  const resultRewardPoints = getQuizResultRewardPoints(starRating, resultCardCount) ?? 0;
  const leaderboardStanding = leaderboardData
    ? t("leaderboard.yourStanding", {
        position: formatNumber(locale, leaderboardData.viewer.position),
      })
    : t("leaderboard.positionLoading");
  const rankLabel = getRankLabel(stats.rank, locale);
  const formatResultDisplayText = (text: string) =>
    canUseSuperWater(locale) ? formatSuperWaterText(locale, text) : text;

  useEffect(() => {
    if (mode !== "active" || !quizSessionId || resultRewardPromiseRef.current) {
      return;
    }

    const rewardPromise =
      quizResultRewardPromises.get(quizSessionId) ??
      awardQuizResultPoints(quizSessionId, starRating, resultCardCount);
    if (!quizResultRewardPromises.has(quizSessionId)) {
      quizResultRewardPromises.set(quizSessionId, rewardPromise);
    }
    resultRewardPromiseRef.current = rewardPromise;

    let active = true;
    void rewardPromise
      .then((result) => {
        if (!result.success) {
          return;
        }

        refreshLeaderboardPositions();

        if (result.awarded && !quizResultRewardedSessions.has(quizSessionId)) {
          quizResultRewardedSessions.add(quizSessionId);
          if (active) {
            setResultRewardAwarded(true);
          }
        }
      })
      .catch(() => {
        // The result remains usable when the persistent reward cannot be saved.
        quizResultRewardPromises.delete(quizSessionId);
      });

    return () => {
      active = false;
    };
  }, [mode, quizSessionId, resultCardCount, starRating]);

  useEffect(() => {
    if (
      mode !== "active" ||
      !quizSessionId ||
      !user ||
      !updateProfileField ||
      resultGemRewardStartedRef.current
    ) {
      return;
    }

    resultGemRewardStartedRef.current = true;
    let active = true;

    void awardProgressGemRewardAction({
      source: "quiz-result",
      claimKey: `quiz-result:${quizSessionId}`,
      stars: starRating,
      cardCount: resultCardCount,
    }).then((result) => {
      if (!active || !result.success) return;

      const rewards = result.awarded ? result.rewards ?? [] : [];
      if (result.balances) {
        resultGemFinalBalancesRef.current = result.balances;
        prepareResultGemDisplay(result.balances, rewards);
        updateProfileField({
          blueGems: result.balances.blue,
          greenGems: result.balances.green,
          purpleGems: result.balances.purple,
        });
      }
      if (result.awarded && result.rewards?.length) {
        setResultGemRewards(result.rewards);
      }
    });

    return () => {
      active = false;
    };
  }, [
    mode,
    prepareResultGemDisplay,
    quizSessionId,
    resultCardCount,
    starRating,
    updateProfileField,
    user,
  ]);

  const startResultPointFlight = useCallback(() => {
    if (flightStartedRef.current || !starSourceRef.current || !scoreRef.current) {
      return;
    }

    flightStartedRef.current = true;
    const sourceBounds = starSourceRef.current.getBoundingClientRect();
    const scoreBounds = scoreRef.current.getBoundingClientRect();
    const targetX = scoreBounds.left + scoreBounds.width / 2;
    const targetY = scoreBounds.top + scoreBounds.height / 2;
    const iconCount = getScoreFlightIconCount(resultRewardPoints);
    const latestStart = 780;

    flightIconCountRef.current = iconCount;
    arrivedFlightIconsRef.current.clear();
    const nextIcons = Array.from({ length: iconCount }, (_, index) => {
      const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
      const startX = sourceBounds.left + sourceBounds.width * (0.15 + Math.random() * 0.7);
      const startY = sourceBounds.top + sourceBounds.height * (0.2 + Math.random() * 0.6);

      return {
        id: index,
        startX,
        startY,
        scatterX: (Math.random() - 0.5) * 150,
        scatterY: -35 - Math.random() * 100,
        targetX,
        targetY,
        delay: Math.round(ratio * latestStart),
      };
    });

    setFlightIcons(nextIcons);
    arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    arrivalTimersRef.current = nextIcons.map((icon) =>
      window.setTimeout(
        () => handleResultPointFlightEndRef.current(icon.id),
        icon.delay + 700,
      ),
    );
  }, [resultRewardPoints]);

  useEffect(() => {
    if (
      mode !== "active" ||
      !resultRewardAwarded ||
      starsRevealedAt === null ||
      flightStartedRef.current
    ) {
      return;
    }

    const elapsed = Date.now() - starsRevealedAt;
    const timer = window.setTimeout(
      startResultPointFlight,
      Math.max(0, 1000 - elapsed),
    );

    return () => window.clearTimeout(timer);
  }, [mode, resultRewardAwarded, starsRevealedAt, startResultPointFlight]);

  const handleResultPointFlightEnd = useCallback(
    (iconId: number) => {
      if (arrivedFlightIconsRef.current.has(iconId)) {
        return;
      }

      arrivedFlightIconsRef.current.add(iconId);
      const arrivalIndex = arrivedFlightIconsRef.current.size;
      const iconCount = flightIconCountRef.current;

      setDisplayPoints(
        resultBasePointsRef.current +
          getScoreFlightAwardAtArrival(resultRewardPoints, iconCount, arrivalIndex),
      );
      setScorePulse(arrivalIndex);
      playSoundEffect("points");
      vibrate("tap");

      if (arrivalIndex === iconCount) {
        arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        arrivalTimersRef.current = [];
        void refreshStats();
        refreshLeaderboardPositions();
        setFlightIcons([]);
      }
    },
    [refreshStats, resultRewardPoints],
  );

  useEffect(() => {
    handleResultPointFlightEndRef.current = handleResultPointFlightEnd;
  }, [handleResultPointFlightEnd]);

  useEffect(
    () => () => {
      arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    if (hasTriggeredResult.current) return;
    hasTriggeredResult.current = true;

    sendTwaAnalyticsEvent("fd_quiz_completed", {
      params: {
        quiz_mode: mode,
        selected_count: selectedCount ?? 0,
        correct_count: results.correct.length,
        incorrect_count: results.incorrect.length,
        learned_count: results.learned.length,
        accuracy: performance.accuracy,
        chest_opened: chestOpened,
        performance_level: performance.level,
        streak_reward_streak: streakRewardStreak,
        streak_reward_points: streakRewardPoints,
      },
    });
    markPlayReviewEligible("quiz");
    playSoundEffect("quiz-complete");
    vibrate("result");

    if (performance.level === "high") {
      window.setTimeout(() => {
        playSoundEffect("confetti");
        vibrate("confetti");
        void confetti({
          particleCount: 140,
          spread: 110,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#facc15", "#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
          disableForReducedMotion: true,
        });
      }, 350);
    }
  }, [
    chestOpened,
    mode,
    performance.accuracy,
    performance.level,
    results.correct.length,
    results.incorrect.length,
    results.learned.length,
    selectedCount,
    streakRewardPoints,
    streakRewardStreak,
  ]);

  const menuConfig = {
    correct: { title: t("quiz.resultCorrect"), cards: results.correct, tone: "emerald" as const },
    incorrect: { title: t("quiz.resultIncorrect"), cards: results.incorrect, tone: "rose" as const },
    learned: { title: t("quiz.resultLearned"), cards: results.learned, tone: "amber" as const },
  } as const;
  const resultCards = [
    {
      key: "correct" as const,
      icon: Check,
      label: t("quiz.resultCorrect"),
      count: results.correct.length,
      tone: "emerald" as const,
    },
    {
      key: "incorrect" as const,
      icon: X,
      label: t("quiz.resultIncorrect"),
      count: results.incorrect.length,
      tone: "rose" as const,
    },
    ...(mode === "active"
      ? [
          {
            key: "learned" as const,
            icon: Trophy,
            label: t("quiz.resultLearned"),
            count: results.learned.length,
            tone: "amber" as const,
          },
        ]
      : []),
  ];

  return (
    <div
      data-quiz-result-view
      className="relative mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center overflow-hidden p-4 sm:p-6 max-lg:p-0"
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
        <RankIcon
          icon={stats.rank.icon}
          className="absolute left-1/2 top-1/2 h-auto w-[115vw] max-w-none -translate-x-1/2 -translate-y-1/2 blur-md saturate-125 opacity-35"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <div
        data-quiz-result-panel
        data-testid="quiz-result-panel"
        className="animate-screen-pop relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-background-card px-4 py-4 text-center shadow-sm sm:px-6 sm:py-6 max-lg:max-w-none max-lg:translate-y-2 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:px-5 max-lg:py-4"
      >
        <div className="flex flex-col items-center gap-2.5 max-lg:gap-2">
          <button
            type="button"
            onClick={() => {
              navigateWithRouteTransition(() => router.push("/leaderboard"));
            }}
            className="flex flex-col items-center gap-1 text-brand"
          >
            <span
              data-leaderboard-standing
              className={cn(
                "bg-gradient-to-r from-[var(--score-highlight)] via-[var(--score-highlight)] to-[var(--score-end)] bg-clip-text text-[2.6rem] font-bold leading-none text-transparent sm:text-5xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatResultDisplayText(leaderboardStanding)}
            </span>
            <span
              data-leaderboard-scope
              className="text-xs font-medium text-foreground-secondary sm:text-sm"
            >
              {t("leaderboard.scope")}
            </span>
          </button>
          <div className="relative flex h-36 w-full items-center justify-center sm:h-52">
            <RankIcon
              icon={stats.rank.icon}
              className="relative z-10 size-24 animate-trophy-intro-grow drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] sm:size-32"
              sizes="(max-width: 640px) 160px, 220px"
            />
          </div>
          <h2
            className={cn(
              "text-xl font-bold text-foreground sm:text-2xl",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatResultDisplayText(rankLabel)}
          </h2>
        </div>

        <div
          className="flex w-full translate-y-2 flex-col items-center"
          data-result-lower-section
        >
          <div ref={starSourceRef} className="relative flex items-center justify-center">
            <QuizStarRating
              rating={starRating}
              className="mt-0.5"
              onRevealComplete={() => setStarsRevealedAt(Date.now())}
            />
          </div>

          <div className="mt-3">
            <div className="relative inline-flex items-center gap-2 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-white shadow-lg">
              <Star className="size-5 fill-current" aria-hidden="true" />
              <span
                ref={scoreRef}
                className={cn(
                  "text-lg font-bold",
                  scorePulse > 0 && "animate-score-bobble",
                )}
                key={scorePulse}
                data-result-score-display
              >
                {formatPoints(locale, displayPoints)}
              </span>
            </div>
          </div>
          <RewardGemHud className="mt-2" balances={resultGemDisplayBalances} pulse={resultGemPulse} animate />

          <div
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 sm:mt-5",
            )}
          >
            {resultCards.map((card) => (
              <ResultCard
                key={card.key}
                resultKey={card.key}
                icon={card.icon}
                label={card.label}
                count={card.count}
                disabled={locked || card.count === 0}
                onClick={() => setOpenMenu(card.key)}
              />
            ))}
          </div>

          <div className="mt-5 flex w-full items-center justify-center gap-5 sm:mt-6">
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.leaderboard}
              imageSizes="56px"
              disabled={locked}
              onClick={() => {
                openLeaderboard();
              }}
              aria-label={t("leaderboard.title")}
              data-result-action="leaderboard"
              className="size-14"
            >
            </ImageActionButton>
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.play}
              imageSizes="80px"
              disabled={locked}
              onClick={onRestart}
              aria-label={t("quiz.restart")}
              data-result-action="play"
              className="size-20"
            >
            </ImageActionButton>
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.menu}
              imageSizes="56px"
              disabled={locked}
              onClick={onExit}
              aria-label={t("quiz.exit")}
              data-result-action="menu"
              className="size-14"
            >
            </ImageActionButton>
          </div>
        </div>
      </div>

      {flightIcons.length > 0
        ? createPortal(
            flightIcons.map((icon) => (
              <span
                key={icon.id}
                aria-hidden="true"
                data-result-score-flight
                className="pointer-events-none fixed left-0 top-0 z-50 animate-quiz-score-icon-flight"
                onAnimationEnd={() => handleResultPointFlightEnd(icon.id)}
                style={{
                  "--score-flight-start-x": `${icon.startX}px`,
                  "--score-flight-start-y": `${icon.startY}px`,
                  "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`,
                  "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
                  "--score-flight-target-x": `${icon.targetX}px`,
                  "--score-flight-target-y": `${icon.targetY}px`,
                  animationDelay: `${icon.delay}ms`,
                } as CSSProperties}
              >
                <ScoreIcon size={32} />
              </span>
            )),
            document.body,
          )
        : null}

      <GemRewardFlight
        key={resultGemRewards.map((item) => `${item.type}-${item.amount}`).join("|") || "no-gem-reward"}
        rewards={starsRevealedAt !== null ? resultGemRewards : null}
        sourceRef={starSourceRef}
        startDelayMs={
          starsRevealedAt === null
            ? 1000
            : Math.max(0, 1000 - (Date.now() - starsRevealedAt))
        }
        onGemArrive={handleResultGemArrive}
        onComplete={() => {
          finishResultGemDisplay(resultGemFinalBalancesRef.current);
          void refreshProfile?.();
        }}
      />

      {openMenu ? (
        <ResultMenu
          title={menuConfig[openMenu].title}
          cards={menuConfig[openMenu].cards}
          tone={menuConfig[openMenu].tone}
          onClose={() => setOpenMenu(null)}
        />
      ) : null}
    </div>
  );
}

function ResultCard({
  resultKey,
  icon: Icon,
  label,
  count,
  disabled,
  onClick,
}: {
  resultKey: "correct" | "incorrect" | "learned";
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { locale } = useLocale();
  const displayLabel = canUseSuperWater(locale)
    ? formatSuperWaterText(locale, label).toLocaleUpperCase("en-US")
    : label.toLocaleUpperCase(locale);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-result-card={resultKey}
      style={{
        backgroundImage: `url('${RESULT_CARD_BACKGROUNDS[resultKey]}')`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
      className={cn(
        "flex aspect-[778/784] w-[98px] shrink-0 flex-col items-center justify-center p-2 text-center text-white transition-[filter,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:p-3",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:brightness-105 active:brightness-95",
      )}
    >
      <Icon className="mx-auto size-4 sm:size-5" aria-hidden="true" />
      <p className="mt-0.5 text-lg font-bold sm:text-xl">{count}</p>
      <p className={cn(
        "text-[10px] font-semibold uppercase text-white/90 sm:text-xs",
        canUseSuperWater(locale) && "font-super-water",
      )}>
        {displayLabel}
      </p>
    </button>
  );
}

function createQuizSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getQuizPerformanceSummary(
  mode: PracticeMode,
  results: QuizResult,
  selectedCount: number | null,
  chestOpened: boolean,
): QuizPerformanceSummary {
  const bonusCorrect = results.bonusCorrect ?? 0;
  const bonusIncorrect = results.bonusIncorrect ?? 0;
  const totalAnswered = results.correct.length + results.incorrect.length + bonusCorrect + bonusIncorrect;
  const accuracy =
    totalAnswered > 0
      ? Math.round(((results.correct.length + bonusCorrect) / totalAnswered) * 100)
      : 0;
  const previewPair =
    mode === "active" && selectedCount
      ? getChestPreviewPairForCount(selectedCount)
      : undefined;
  const chestUnlocked = accuracy >= 80 && Boolean(previewPair) && !chestOpened;

  if (accuracy >= 90) {
    return {
      accuracy,
      chestUnlocked,
      icon: Trophy,
      level: "high",
      messageKeys: QUIZ_RESULT_MESSAGE_KEYS.high,
      ringClassName: "border-amber-200 bg-amber-50",
      textClassName: "text-amber-700",
    };
  }

  if (accuracy >= 70) {
    return {
      accuracy,
      chestUnlocked,
      icon: Medal,
      level: "mediumHigh",
      messageKeys: QUIZ_RESULT_MESSAGE_KEYS.mediumHigh,
      ringClassName: "border-sky-200 bg-sky-50",
      textClassName: "text-sky-700",
    };
  }

  if (accuracy >= 50) {
    return {
      accuracy,
      chestUnlocked: false,
      icon: Star,
      level: "mediumLow",
      messageKeys: QUIZ_RESULT_MESSAGE_KEYS.mediumLow,
      ringClassName: "border-emerald-200 bg-emerald-50",
      textClassName: "text-emerald-700",
    };
  }

  return {
    accuracy,
    chestUnlocked: false,
    icon: XCircle,
    level: "low",
    messageKeys: QUIZ_RESULT_MESSAGE_KEYS.low,
    ringClassName: "border-rose-200 bg-rose-50",
    textClassName: "text-rose-700",
  };
}

function ResultMenu({
  title,
  cards,
  tone,
  onClose,
}: {
  title: string;
  cards: VocabularyCard[];
  tone: "emerald" | "rose" | "amber";
  onClose: () => void;
}) {
  const t = useT();
  const toneClassName = {
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
  } as const;

  return createPortal(
    <div
      className="animate-screen-pop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm max-lg:bg-background max-lg:p-0 max-lg:backdrop-blur-none"
      data-result-menu
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background-card shadow-2xl max-lg:h-full max-lg:max-h-none max-lg:rounded-none max-lg:border-0"
        data-result-menu-panel
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn("h-2 w-full shrink-0", toneClassName[tone])} data-result-menu-accent />
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-3 -translate-y-1/2 bg-black dark:bg-white"
          aria-hidden="true"
        />
        <div
          className="flex shrink-0 items-center justify-between border-b border-border bg-background-card p-4"
          data-result-menu-header
        >
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4"
          data-result-menu-scroll
        >
          {cards.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground-secondary">
              No cards
            </p>
          ) : (
            <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cards.map((card) => (
                <VocabularyCardView
                  key={card.id}
                  card={card}
                  owned={false}
                  className="h-full min-h-[320px] w-full"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
