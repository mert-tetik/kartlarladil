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
  type CSSProperties, type ReactNode, type SyntheticEvent,
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
  Target,
  Timer,
  Trophy,
  Volume2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LANGUAGES } from "@/data/languages";
import { TIER_STYLES } from "@/data/tiers";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { CARD_GROUP_IMAGE_PATHS } from "@/features/cards/card-groups";
import {
  preloadQuizFeedbackMascotAnimation,
  pickQuizFeedbackBarMascotAnimation,
  pickQuizFeedbackMascotAnimation,
  QuizFeedbackMascotAnimationView,
  type QuizFeedbackMascotAnimation,
} from "@/features/quiz/components/quiz-feedback-mascot-animation";
import { useCardPronunciation } from "@/features/cards/card-pronunciation-client";
import {
  getCardTranslation,
  getCardTranslationMeanings,
  getStudyLocale,
} from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { QuizSpeechBubble, getRandomQuizCharacter } from "@/features/quiz/components/quiz-speech-bubble";
import {
  getCharacterName,
  getCharacterVoiceProfile,
} from "@/features/ai-practice/ai-practice-data";
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
  buildGroupQuestion,
  shouldUseGroupQuestion,
  type GroupQuestion,
} from "@/features/quiz/group-question";
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
import {
  BONUS_QUESTION_PROBABILITY,
  getMaxBonusQuestionCount,
} from "@/features/quiz/bonus-question-constants";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import {
  useAuthSession,
  useRequireAuthAction,
} from "@/features/auth/auth-client";
import { getPointsForTier, RANK_ACCENT_COLORS } from "@/features/progress/progress-stats";
import { useProgressStats } from "@/features/progress/progress-client";
import { QuizMobileActionPortal } from "@/features/quiz/components/quiz-mobile-action-portal";
import { QuizWordButton } from "@/features/quiz/components/quiz-word-button";
import { QuizCountSelection } from "@/features/quiz/components/quiz-count-selection";
import { RankUpMenu } from "@/features/progress/components/rank-progress-popover";
import { acknowledgeRankUp, setQuizRankUpDeferred } from "@/features/progress/rank-up-flow";
import { aiValidateTextAnswer } from "@/features/quiz/ai-validate-answer";
import {
  awardChestPoints,
  claimQuizResultMedals,
  awardQuizBonusPoints,
  awardQuizStreakPoints,
} from "@/features/quiz/actions";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { markPlayReviewEligible } from "@/features/reviews/play-review-eligibility";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import type { ChestRewardOutcome, GemBalances, GemRewards } from "@/features/gems/gem-types";
import { createChestRewardPreview } from "@/features/gems/chest-reward-preview";
import { spendGemAction } from "@/features/gems/gem-actions";
import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { QuizChestRewardGate } from "@/features/quiz/components/quiz-chest-reward-gate";
import { QuizContinuationMotivationView } from "@/features/quiz/components/quiz-continuation-motivation-view";
import type { QuizContinuationMotivationInput } from "@/features/quiz/quiz-continuation-motivations";
import { QuizStartSplash } from "@/features/quiz/components/quiz-start-splash";
import {
  BonusQuestionView,
} from "@/features/quiz/components/bonus-question-view";
import { QuizStreakCelebrationView } from "@/features/quiz/components/quiz-streak-celebration-view";
import { QuizStreakRewardView } from "@/features/quiz/components/quiz-streak-reward-view";
import { QuizCompletionProgressView } from "@/features/quiz/components/quiz-completion-progress-view";
import { QuizMedalRating } from "@/features/quiz/components/quiz-medal-rating";
import {
  getChestTierByCount,
  resolveAwardedChestTier,
  QUIZ_COUNT_OPTIONS,
  getChestPreviewPairForCount,
  getChestRewardPoints,
  type ChestTier,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import { getQuizStreakRewardPoints, getRewardableQuizStreak } from "@/features/quiz/streak-rewards";
import { getQuizResultRewardPoints } from "@/features/quiz/result-rewards";
import { EmptyState } from "@/components/empty-state";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import { useOptionalMobileDayStreakOverlay } from "@/app/components/mobile-day-streak-overlay-provider";
import { LanguageFlag } from "@/components/language-flag";
import { ScoreIcon } from "@/components/score-icon";
import { Badge } from "@/components/ui/badge";
import { RankIcon } from "@/features/progress/rank-icons";
import { Button, buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSkipButton } from "@/features/quiz/components/quiz-skip-button";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { RewardMedalHud } from "@/features/progress/components/reward-medal-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { GEM_ASSETS, GEM_COSTS } from "@/features/gems/gem-types";
import type { RewardScatterRect } from "@/features/progress/reward-scatter";

import {
  formatCards,
  formatNumber,
  getLanguageDisplayName,
  getRankLabel,
} from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import {
  canUseSuperWater,
  formatSuperWaterText,
  formatSuperWaterUppercaseText,
} from "@/lib/super-water";
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
  RankIconId,
  VocabularyCard,
} from "@/types/domain";

type QuizPhase =
  | "language"
  | "count"
  | "quiz"
  | "quiz-completion"
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

type QuizViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
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

const QUIZ_COUNT_IMAGE_PATHS: Record<number, string> = {
  10: "/quiz/count-options/10.png",
  20: "/quiz/count-options/20.png",
  30: "/quiz/count-options/30.png",
  50: "/quiz/count-options/50.png",
};

const QUIZ_COUNT_IMAGE_CIRCLE_CLASS =
  "flex size-[clamp(8.75rem,23vw,14.5rem)] shrink-0 translate-y-2 items-center justify-center rounded-full bg-white p-[clamp(0.55rem,1.45vw,1rem)] shadow-[0_0.4rem_0.9rem_rgba(0,0,0,0.14)] sm:translate-y-3";

const COUNT_INTRO_HOLD_DURATION_MS = 1700;
const COUNT_BUTTON_STAGGER_DURATION_MS = 100;
const COUNT_BUTTON_ENTER_DURATION_MS = 680;
const COUNT_BUTTONS_ENTER_TOTAL_DURATION_MS =
  COUNT_BUTTON_ENTER_DURATION_MS +
  COUNT_BUTTON_STAGGER_DURATION_MS * (QUIZ_COUNT_OPTIONS.length - 1);
const COUNT_CENTER_ENTER_DELAY_MS =
  COUNT_BUTTON_STAGGER_DURATION_MS * QUIZ_COUNT_OPTIONS.length;
const COUNT_INTRO_EXIT_DURATION_MS = 500;
const COUNT_SELECTION_COVER_DURATION_MS = 820;

function getQuizCountButtonColor(count: number) {
  const index = QUIZ_COUNT_OPTIONS.findIndex((option) => option === count);
  return QUIZ_COUNT_BUTTON_COLORS[index >= 0 ? index : 0];
}

const RESULT_CARD_TONES = {
  correct: "border-[#2ee88a] text-[#2ee88a]",
  incorrect: "border-[#ff4f61] text-[#ff4f61]",
  learned: "border-amber-400 text-amber-400",
} as const;

const QUIZ_COUNT_MIN = 10;
const QUIZ_CARD_FLIP_DURATION_MS = 250;
const QUIZ_CARD_GROW_DURATION_MS = 480;
const QUIZ_CARD_LARGE_HOLD_DURATION_MS = 1_400;
const QUIZ_CARD_REVEAL_ENTER_DURATION_MS = 360;
const QUIZ_CARD_PROGRESS_ADVANCE_DURATION_MS = 900;
const QUIZ_CARD_PROGRESS_IDLE_ROTATION_DURATION_MS = 800;
const QUIZ_QUESTION_ENTRY_DURATION_MS = 360;
const QUIZ_FLOW_TRANSITION_DURATION_MS = 360;
const QUIZ_COMPLETION_TOPBAR_FADE_DURATION_MS = 720;
const QUIZ_FLOW_INCOMING_DELAY_MS = 500;
const QUIZ_BUTTON_FEEDBACK_DURATION_MS = 700;
const NORMAL_ANSWER_AUTO_ADVANCE_DELAY_MS = QUIZ_BUTTON_FEEDBACK_DURATION_MS;
const QUIZ_CARD_PROGRESS_FOOTER_HEIGHT_PX = 56;
const QUIZ_CARD_RETURN_SETTLE_DURATION_MS = QUIZ_CARD_GROW_DURATION_MS + 80;
const QUIZ_CARD_COMPACT_SCALE = 0.78;
const QUIZ_CARD_CENTER_SCALE = 1.35;

const TIER_RAY_COLOR_VARIABLES: Record<VocabularyCard["tier"], string> = {
  A1: "var(--tier-a1)",
  A2: "var(--tier-a2)",
  B1: "var(--tier-b1)",
  B2: "var(--tier-b2)",
  C1: "var(--tier-c1)",
};

const TIER_CONFETTI_COLORS: Record<VocabularyCard["tier"], string> = {
  A1: "#10b981",
  A2: "#0ea5e9",
  B1: "#8b5cf6",
  B2: "#f59e0b",
  C1: "#f43f5e",
};

function QuizTierRayField({
  tier,
  fading = false,
}: {
  tier: VocabularyCard["tier"];
  fading?: boolean;
}) {
  return (
    <div
      className={cn("quiz-tier-ray-field", fading && "quiz-tier-ray-field--fading")}
      style={{ "--quiz-tier-ray-color": TIER_RAY_COLOR_VARIABLES[tier] } as CSSProperties}
      aria-hidden="true"
    />
  );
}

interface BaseQuizItem {
  card: VocabularyCard;
  inventoryCard: InventoryCard;
  willLearn: boolean;
  forceLearned?: boolean;
  isBonus?: false;
}

export interface ChoiceQuizItem extends BaseQuizItem {
  questionType: "choice";
  question: QuizQuestion;
}

export interface ListeningQuizItem extends BaseQuizItem {
  questionType: "listening";
  question: ListeningQuizQuestion;
}

export interface DefinitionQuizItem extends BaseQuizItem {
  questionType: "definition";
  question: DefinitionQuizQuestion;
}

export interface TextQuizItem extends BaseQuizItem {
  questionType: "text";
  question: { correctAnswer: string };
}

export interface TrueFalseQuizItem extends BaseQuizItem {
  questionType: "true-false";
  question: TrueFalseQuizQuestion;
}

export interface SentenceCompletionQuizItem extends BaseQuizItem {
  questionType: "sentence-completion";
  question: SentenceCompletionQuizQuestion;
  character: AiPracticeCharacter;
}

export interface GroupQuizItem extends BaseQuizItem {
  questionType: "group";
  question: GroupQuestion;
  character: AiPracticeCharacter;
}

interface BonusQuizItem extends Omit<BaseQuizItem, "isBonus"> {
  isBonus: true;
  bonusId: string;
  questionType: `bonus-${BonusQuestionKind}`;
  bonusQuestion: BonusQuestion;
}

type QuizItem = ChoiceQuizItem | ListeningQuizItem | DefinitionQuizItem | TextQuizItem | TrueFalseQuizItem | SentenceCompletionQuizItem | GroupQuizItem | BonusQuizItem;
export type NormalQuizItem = ChoiceQuizItem | ListeningQuizItem | DefinitionQuizItem | TextQuizItem | TrueFalseQuizItem | SentenceCompletionQuizItem | GroupQuizItem;
type QuizCardFeedbackStage = "idle" | "appearing" | "growing" | "revealing" | "updating";

type PreparedBonusPlan = {
  index: number;
  kind: BonusQuestionKind;
  fallback: BonusQuestion | null;
  selectedForMaxDeck: boolean;
};

type PreparedQuizPool = {
  key: string;
  regularItems: QuizItem[];
  bonusCards: VocabularyCard[];
  bonusLearnedCards: VocabularyCard[];
  bonusPlans: PreparedBonusPlan[];
};

interface QuizRerollAction {
  onReroll: () => void;
  disabled: boolean;
  loading: boolean;
}

export interface QuizCardProgressFeedback {
  id: string;
  cardId: string;
  stage: Exclude<QuizCardFeedbackStage, "idle">;
  baseCount: number;
  targetCount: number;
}

export interface QuizCardProgressRevealItem {
  card: VocabularyCard;
  inventoryCard: InventoryCard;
}

interface QuizResult {
  correct: VocabularyCard[];
  incorrect: VocabularyCard[];
  learned: VocabularyCard[];
  bonusCorrect?: number;
  bonusIncorrect?: number;
}

function getQuizAchievementCards(results: QuizResult) {
  const learnedCards = Array.from(
    new Map(results.learned.map((card) => [card.id, card])).values(),
  );
  const learnedIds = new Set(learnedCards.map((card) => card.id));
  const advancedCards = Array.from(
    new Map(
      results.correct
        .filter((card) => !learnedIds.has(card.id))
        .map((card) => [card.id, card]),
    ).values(),
  );

  return { learnedCards, advancedCards };
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

const TEXT_MASCOT_SELECTION_ROLLS = [0.99, 0.6, 0.2] as const;

function formatQuizDuration(totalSeconds: number) {
  const normalizedSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function QuizStation({
  mode,
  initialLanguage,
  normalQuestionType,
  bonusAfterEachNormalQuestion = false,
  quizCompletionTest = false,
  quizFlowTest = false,
  onPhaseChange,
  onBackToMode,
}: {
  mode: PracticeMode;
  initialLanguage?: LanguageCode;
  normalQuestionType?: NormalQuizItem["questionType"] | null;
  bonusAfterEachNormalQuestion?: boolean;
  quizCompletionTest?: boolean;
  quizFlowTest?: boolean;
  onPhaseChange?: (phase: QuizPhase) => void;
  onBackToMode?: () => void;
}) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
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
  const [maxStreak, setMaxStreak] = useState(0);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [quizDurationSeconds, setQuizDurationSeconds] = useState<number | null>(null);
  const [pendingAnswerWrites, setPendingAnswerWrites] = useState(0);
  const [pendingChestAward, setPendingChestAward] = useState(false);
  const [pendingStreakAward, setPendingStreakAward] = useState(false);
  const [rerollingQuestion, setRerollingQuestion] = useState(false);
  const [pendingRankUp, setPendingRankUp] = useState<RankDefinition | null>(null);
  const [pendingRankUpFromRank, setPendingRankUpFromRank] = useState<RankDefinition | null>(null);
  const [rankUpReturn, setRankUpReturn] = useState<"quiz" | "result" | null>(null);
  const [bonusFlightActive, setBonusFlightActive] = useState(false);
  const [bonusRewardRevealVisible, setBonusRewardRevealVisible] = useState(false);
  const [bonusRewardReady, setBonusRewardReady] = useState(false);
  const [chestCelebrationNextPhase, setChestCelebrationNextPhase] = useState<
    "chest" | "streak-reward" | "result-pending" | null
  >(null);
  const [quizCompletionNextPhase, setQuizCompletionNextPhase] = useState<
    "streak-reward" | "rank-up" | "result-pending"
  >("result-pending");
  const [quizCompletionTestNextIndex, setQuizCompletionTestNextIndex] = useState<number | null>(null);
  const [resultMessageOnResult, setResultMessageOnResult] = useState(false);
  const [bonusPointFlightEnabled, setBonusPointFlightEnabled] = useState(false);
  const [bonusGemRewards, setBonusGemRewards] = useState<GemRewards>([]);
  const [bonusPointsDisplayed, setBonusPointsDisplayed] = useState(0);
  const [bonusScorePulse, setBonusScorePulse] = useState(0);
  const [supportsViewTransition, setSupportsViewTransition] = useState(false);
  const useCssQuizTransitionRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const normalAnswerAdvanceTimeoutRef = useRef<number | null>(null);
  const bonusRewardRevealTimeoutRef = useRef<number | null>(null);
  const bonusRewardAutoAdvanceTimeoutRef = useRef<number | null>(null);
  const deferredRecordTimeoutRef = useRef<number | null>(null);
  const cardProgressTimeoutIdsRef = useRef<number[]>([]);
  const awardedStreakSessionRef = useRef<string | null>(null);
  const quizStartRankRef = useRef<RankDefinition | null>(null);
  const quizStartedAtRef = useRef<number | null>(null);
  const quizBasePointsRef = useRef(stats.totalPoints);
  const statsRef = useRef(stats);
  const pendingAdvanceRef = useRef<AdvanceQuizOptions | null>(null);
  const rankCheckInFlightRef = useRef(false);
  const rankCheckNeededRef = useRef(false);
  const bonusFlightBaseRef = useRef(0);
  const bonusRewardRequestRef = useRef(0);
  const bonusPointFlightDoneRef = useRef(true);
  const bonusGemFlightDoneRef = useRef(true);
  const bonusGemFinalBalancesRef = useRef<GemBalances | null>(null);
  const bonusRewardFlowCompletedRef = useRef(false);
  const bonusRewardClaimedRef = useRef(false);
  const bonusDeckTokenRef = useRef(0);
  const textMascotSequenceRef = useRef<{
    nextIndex: number;
    itemKey: string | null;
    animation: QuizFeedbackMascotAnimation | null;
  }>({
    nextIndex: 0,
    itemKey: null,
    animation: null,
  });
  const preparedQuizPoolRef = useRef<PreparedQuizPool | null>(null);
  const quizPoolPreparationTokenRef = useRef(0);
  const currentIndexRef = useRef(0);
  const redirectStartedRef = useRef(false);
  const {
    balances: bonusGemDisplayBalances,
    pulse: bonusGemPulse,
    prepare: prepareBonusGemDisplay,
    handleGemArrive: handleBonusGemArrive,
    finish: finishBonusGemDisplay,
  } = useGemRewardDisplay();

  const getNextTextMascotAnimation = useCallback((itemKey: string) => {
    const sequence = textMascotSequenceRef.current;

    if (sequence.itemKey === itemKey && sequence.animation) {
      return sequence.animation;
    }

    const selectionRoll = TEXT_MASCOT_SELECTION_ROLLS[
      sequence.nextIndex % TEXT_MASCOT_SELECTION_ROLLS.length
    ];
    const animation = pickQuizFeedbackMascotAnimation(false, 0, selectionRoll);
    sequence.nextIndex += 1;
    sequence.itemKey = itemKey;
    sequence.animation = animation;
    return animation;
  }, []);

  useLayoutEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    setSupportsViewTransition(
      typeof document !== "undefined" &&
        typeof (document as QuizViewTransitionDocument).startViewTransition === "function",
    );
  }, []);

  type FallbackTransitionSnapshot = {
    snapshot: HTMLElement;
    source: HTMLElement;
  };

  function createFallbackTransitionSnapshot({
    fadeQuizTopBar = false,
  }: {
    fadeQuizTopBar?: boolean;
  } = {}): FallbackTransitionSnapshot | null {
    const quizPage = document.querySelector<HTMLElement>("[data-learn-quiz-page='quiz']");
    const quizStage = fadeQuizTopBar ? quizPage?.parentElement : null;
    const source =
      document.querySelector<HTMLElement>("[data-bonus-reward-reveal]") ??
      document.querySelector<HTMLElement>("[data-streak-celebration-view]") ??
      document.querySelector<HTMLElement>("[data-quiz-completion-progress]") ??
      document.querySelector<HTMLElement>("[data-quiz-card-progress-reveal]") ??
      document.querySelector<HTMLElement>("[data-quiz-celebration]") ??
      document.querySelector<HTMLElement>("[data-quiz-count-selection]") ??
      quizStage ??
      quizPage;
    if (!source) return null;

    const isCountSelectionSnapshot = source.matches("[data-quiz-count-selection]");
    const isQuizStageSnapshot = source === quizStage;
    const snapshot = source.cloneNode(true) as HTMLElement;
    snapshot.removeAttribute("style");
    snapshot.setAttribute("aria-hidden", "true");
    // The fallback copy is only a visual snapshot. Keep it out of the
    // page-level :has() selectors that control Learn's navbar/viewport mode;
    // otherwise the count screen can briefly re-assert its layout while the
    // first question and its bottom actions are being mounted.
    snapshot.setAttribute("data-quiz-transition-fallback-old", "true");
    // Do not leave the count marker on the detached visual copy. The marker is
    // consumed by Learn's body:has() layout rules; keeping it on the snapshot
    // makes the page switch back to count geometry for one or more frames
    // while the first question is mounting.
    if (isCountSelectionSnapshot) {
      snapshot.removeAttribute("data-quiz-count-selection");
      snapshot.setAttribute("data-quiz-transition-fallback-count", "true");
    }
    if (isQuizStageSnapshot) {
      snapshot.setAttribute("data-quiz-transition-fallback-quiz-stage", "true");
    }
    if (fadeQuizTopBar) {
      const topBar = snapshot.querySelector<HTMLElement>("[data-mobile-quiz-top-bar]");
      if (topBar) {
        topBar.classList.add("quiz-completion-topbar-fade");

        const removeTopBar = () => {
          topBar.removeEventListener("animationend", handleTopBarAnimationEnd);
          topBar.remove();
        };
        const handleTopBarAnimationEnd = (event: AnimationEvent) => {
          if (
            event.target === topBar &&
            event.animationName === "quiz-completion-topbar-fade"
          ) {
            removeTopBar();
          }
        };

        topBar.addEventListener("animationend", handleTopBarAnimationEnd);
        // Keep the transition robust if animation events are suppressed by a
        // browser or reduced-motion setting.
        window.setTimeout(removeTopBar, QUIZ_COMPLETION_TOPBAR_FADE_DURATION_MS + 40);
      }
    }
    snapshot.querySelectorAll<HTMLElement>(".quiz-flow-enter-right, .quiz-flow-exit-left").forEach((element) => {
      element.classList.remove("quiz-flow-enter-right", "quiz-flow-exit-left");
    });
    if (isCountSelectionSnapshot) {
      snapshot.querySelectorAll<HTMLElement>(
        ".animate-quiz-word-button-correct, .animate-quiz-word-button-correct-shine, .animate-quiz-word-button-select, .animate-bonus-incorrect-shake",
      ).forEach((element) => {
        element.classList.remove(
          "animate-quiz-word-button-correct",
          "animate-quiz-word-button-correct-shine",
          "animate-quiz-word-button-select",
          "animate-bonus-incorrect-shake",
        );
        element.style.transform = "none";
      });
    }
    snapshot.classList.add("quiz-transition-fallback-old");
    document.body.appendChild(snapshot);
    return { snapshot, source };
  }

  type QuizViewTransitionOptions = {
    delayIncomingMs?: number;
    fadeQuizTopBar?: boolean;
  };

  function runQuizViewTransition(
    update: () => void,
    { delayIncomingMs = 0, fadeQuizTopBar = false }: QuizViewTransitionOptions = {},
  ) {
    if (typeof document === "undefined") {
      update();
      return;
    }

    const transitionDocument = document as QuizViewTransitionDocument;
    // Count selection and the first quiz question do not share the same
    // geometry: count is normal flow, while the quiz is a fixed viewport.
    // Native View Transitions capture the shared stage after that geometry
    // changes and interpolate its top/height for one frame. Use the explicit
    // snapshot path for this boundary so the old screen is fully detached
    // before the new fixed viewport mounts.
    const isCountBoundary = Boolean(
      document.querySelector<HTMLElement>("[data-quiz-count-selection]"),
    );
    const isBonusRewardBoundary = Boolean(
      document.querySelector<HTMLElement>("[data-bonus-reward-reveal]"),
    );
    const isStreakBoundary = Boolean(
      document.querySelector<HTMLElement>("[data-streak-celebration-view]"),
    );
    const isQuizCompletionBoundary = Boolean(
      document.querySelector<HTMLElement>("[data-quiz-completion-progress]"),
    );
    const hasNativeTransition =
      typeof transitionDocument.startViewTransition === "function";
    const shouldDelayIncoming = delayIncomingMs > 0;
    // The reward reveal is portaled to document.body, while the next question
    // lives inside the quiz stage. Native View Transitions would capture the
    // underlying bonus question instead of the visible reward screen.
    const useNativeTransition =
      hasNativeTransition &&
      !isCountBoundary &&
      !isBonusRewardBoundary &&
      !isStreakBoundary &&
      !isQuizCompletionBoundary &&
      !fadeQuizTopBar &&
      !shouldDelayIncoming;
    useCssQuizTransitionRef.current = !useNativeTransition;

    if (useNativeTransition) {
      transitionDocument.startViewTransition!(() => {
        flushSync(update);
      });
      return;
    }

    const fallbackTransition = createFallbackTransitionSnapshot({ fadeQuizTopBar });

    if (shouldDelayIncoming) {
      if (!fallbackTransition) {
        window.setTimeout(update, delayIncomingMs);
        return;
      }

      // Keep the real outgoing screen from reappearing after the visual copy
      // has completed its exit. The target must mount only after the blank
      // settling interval, so its own entrance animation starts from a clean
      // frame instead of being composited over the previous screen.
      fallbackTransition.source.setAttribute(
        "data-quiz-transition-fallback-source-hidden",
        "true",
      );

      window.setTimeout(() => {
        fallbackTransition.snapshot.remove();
        update();

        // In the normal case React unmounts the old source during `update`.
        // Restore it defensively when a caller keeps the same source mounted.
        window.setTimeout(() => {
          fallbackTransition.source.removeAttribute(
            "data-quiz-transition-fallback-source-hidden",
          );
        }, 0);
      }, QUIZ_FLOW_TRANSITION_DURATION_MS + delayIncomingMs);
      return;
    }

    update();
    if (fallbackTransition) {
      window.setTimeout(
        () => fallbackTransition.snapshot.remove(),
        QUIZ_FLOW_TRANSITION_DURATION_MS,
      );
    }
  }

  function transitionToStreakCelebration() {
    runQuizViewTransition(() => {
      setPendingStreak(false);
      setPhase("streak-celebration");
    });
  }

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

  const clearNormalAnswerAdvance = useCallback(() => {
    if (normalAnswerAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(normalAnswerAdvanceTimeoutRef.current);
      normalAnswerAdvanceTimeoutRef.current = null;
    }
  }, []);

  const startCardProgressFeedback = useCallback((item: QuizItem, isCorrect: boolean) => {
    if (
      mode !== "active" ||
      !isCorrect ||
      item.questionType === "text" ||
      item.willLearn ||
      isBonusQuizItem(item)
    ) {
      return false;
    }

    clearCardProgressFeedback();

    const id = `${currentIndex}:${item.card.id}`;
    const baseCount = item.inventoryCard.correctCount;
    const targetCount = Math.max(
      0,
      Math.min(getTierRequirement(item.card.tier), baseCount + (isCorrect ? 1 : -1)),
    );

    const revealTimeoutId = window.setTimeout(() => {
      runQuizViewTransition(() => {
        setCardProgressFeedback({
          id,
          cardId: item.card.id,
          stage: "appearing",
          baseCount,
          targetCount,
        });
      });
      cardProgressTimeoutIdsRef.current = cardProgressTimeoutIdsRef.current.filter(
        (activeTimeoutId) => activeTimeoutId !== revealTimeoutId,
      );
    }, QUIZ_BUTTON_FEEDBACK_DURATION_MS);
    cardProgressTimeoutIdsRef.current.push(revealTimeoutId);

    // Let the card enter after the answer buttons settle. The progress
    // increment itself is intentionally owned by the one-time tap on the
    // reveal screen, so the learner cannot accidentally skip its animation.
    return true;
  }, [clearCardProgressFeedback, currentIndex, mode]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

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
  const cloudInventoryReady = cloudLoadComplete || (!cloudEnabled && canRenderPersistedQuizSetup);
  const interactionLocked = !hydrated;

  useEffect(() => {
    const hasQuizCardsForCurrentSetup =
      practiceLanguageStats.length > 0 &&
      (!selectedLanguage || (selectedLanguage !== locale && availableCards.length > 0));

    if (
      !hydrated ||
      cloudLoading ||
      !cloudInventoryReady ||
      hasQuizCardsForCurrentSetup ||
      (phase !== "language" && phase !== "count") ||
      redirectStartedRef.current
    ) {
      return;
    }

    redirectStartedRef.current = true;
    navigateWithRouteTransition(() => router.replace("/"));
  }, [
    availableCards.length,
    cloudInventoryReady,
    cloudLoading,
    hydrated,
    languageStats.length,
    locale,
    phase,
    practiceLanguageStats.length,
    router,
    selectedLanguage,
  ]);

  const getQuizPoolKey = useCallback(
    (language: LanguageCode) => [
      language,
      mode,
      normalQuestionType ?? "default",
      bonusAfterEachNormalQuestion ? "bonus-after-each" : "bonus-default",
      locale,
      cards.map((item) => `${item.cardId}:${item.status}:${item.correctCount}`).join(","),
    ].join("::"),
    [bonusAfterEachNormalQuestion, cards, locale, mode, normalQuestionType],
  );

  const prepareQuizPool = useCallback(
    (language: LanguageCode): PreparedQuizPool => {
      const key = getQuizPoolKey(language);
      const source = filterInventoryCards({
        cards,
        language,
        status: mode,
      }).map((item) => item.card);
      const maxRegularCount = Math.min(
        Math.max(...QUIZ_COUNT_OPTIONS),
        source.length,
      );
      const listeningCards = [...VOCABULARY_CARDS, ...source];
      const inventoryById = new Map(cards.map((item) => [item.cardId, item]));
      const shuffled = shuffle(source).slice(0, maxRegularCount);
      const hasNoLearnedCards = !cards.some((item) => item.status === "learned");

      const regularItems: QuizItem[] = shuffled.map((card, index): QuizItem | null => {
        const inventoryCard = inventoryById.get(card.id);
        if (!inventoryCard) return null;

        const requirement = getTierRequirement(card.tier);
        const answerLocale = getStudyLocale(card.language, locale);

        if (normalQuestionType) {
          const willLearn =
            inventoryCard.status !== "learned" &&
            inventoryCard.correctCount + 1 >= requirement;
          const forceLearned = mode === "active" && hasNoLearnedCards && index === 0;

          switch (normalQuestionType) {
            case "choice":
              return {
                card,
                inventoryCard,
                questionType: "choice",
                question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
                willLearn,
                forceLearned,
              };
            case "listening": {
              const question = buildListeningQuizQuestion(card, listeningCards);
              return question
                ? { card, inventoryCard, questionType: "listening", question, willLearn, forceLearned }
                : null;
            }
            case "definition": {
              const question = buildDefinitionQuizQuestion(card, VOCABULARY_CARDS, answerLocale);
              return question
                ? { card, inventoryCard, questionType: "definition", question, willLearn, forceLearned }
                : null;
            }
            case "text":
              return {
                card,
                inventoryCard,
                questionType: "text",
                question: { correctAnswer: card.term },
                willLearn,
                forceLearned,
              };
            case "true-false":
              return {
                card,
                inventoryCard,
                questionType: "true-false",
                question: buildTrueFalseQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
                willLearn,
                forceLearned,
              };
            case "sentence-completion": {
              const question = buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS);
              return question
                ? {
                    card,
                    inventoryCard,
                    questionType: "sentence-completion",
                    question,
                    character: getRandomQuizCharacter(),
                    willLearn,
                    forceLearned,
                  }
                : null;
            }
            case "group": {
              const question = buildGroupQuestion(
                card,
                createSeededRandom(`${key}-group-${card.id}`),
              );
              return question
                ? {
                    card,
                    inventoryCard,
                    questionType: "group",
                    question,
                    character: getRandomQuizCharacter(),
                    willLearn,
                    forceLearned,
                  }
                : null;
            }
          }
        }

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

        const groupRandom = createSeededRandom(`${key}-group-${card.id}`);
        if (shouldUseGroupQuestion(groupRandom)) {
          const groupQuestion = buildGroupQuestion(card, groupRandom);

          if (groupQuestion) {
            return {
              card,
              inventoryCard,
              questionType: "group",
              question: groupQuestion,
              character: getRandomQuizCharacter(),
              willLearn: false,
            };
          }
        }

        if (shouldUseTrueFalseQuestion(inventoryCard, mode)) {
          return {
            card,
            inventoryCard,
            questionType: "true-false",
            question: buildTrueFalseQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
            willLearn: false,
          };
        }

        if (shouldUseListeningQuestion()) {
          const listeningQuestion = buildListeningQuizQuestion(card, listeningCards);

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
          question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
          willLearn: false,
        };
      }).filter((item): item is QuizItem => item !== null);

      const bonusInventoryCards = filterInventoryCards({
        cards,
        language,
        status: "all",
      });
      const bonusCards = bonusInventoryCards.map((item) => item.card);
      const bonusLearnedCards = bonusInventoryCards
        .filter((item) => item.inventory.status === "learned")
        .map((item) => item.card);
      const forceBonusAfterEach = bonusAfterEachNormalQuestion && !normalQuestionType;
      const maxBonusQuestionCount = forceBonusAfterEach
        ? regularItems.length
        : normalQuestionType
          ? 0
          : getMaxBonusQuestionCount(regularItems.length);
      const bonusPlans = regularItems.map((_, index): PreparedBonusPlan => {
        const preferredKind = getBonusKind(index);
        const candidateKinds = [
          preferredKind,
          ...shuffle(BONUS_QUESTION_KINDS.filter((kind) => kind !== preferredKind)),
        ];
        let selectedKind = preferredKind;
        let selectedFallback: BonusQuestion | null = null;

        for (const candidateKind of candidateKinds) {
          const candidateFallback = buildFallbackBonusQuestion(
            candidateKind,
            bonusCards,
            language,
            locale,
            `${key}-bonus-${candidateKind}-${index}`,
            bonusLearnedCards,
          );

          if (candidateFallback) {
            selectedKind = candidateKind;
            selectedFallback = candidateFallback;
            break;
          }
        }

        return {
          index,
          kind: selectedKind,
          fallback: selectedFallback,
          selectedForMaxDeck: Boolean(
            selectedFallback && (
              forceBonusAfterEach || Math.random() < BONUS_QUESTION_PROBABILITY
            ),
          ),
        };
      });

      if (
        maxBonusQuestionCount > 0 &&
        !bonusPlans.some((plan) => plan.selectedForMaxDeck && plan.fallback)
      ) {
        const availableBonusPlans = bonusPlans.filter((plan) => plan.fallback);
        const forcedPlan =
          availableBonusPlans[Math.floor(Math.random() * availableBonusPlans.length)];
        if (forcedPlan) forcedPlan.selectedForMaxDeck = true;
      }

      return {
        key,
        regularItems,
        bonusCards,
        bonusLearnedCards,
        bonusPlans,
      };
    },
    [
      bonusAfterEachNormalQuestion,
      cards,
      getQuizPoolKey,
      locale,
      mode,
      normalQuestionType,
    ],
  );

  const buildDeck = useCallback(
    (
      language: LanguageCode,
      count: number | null,
      options?: {
        startSplashAlreadyShown?: boolean;
        deferPhase?: boolean;
        preparedPool?: PreparedQuizPool;
      },
    ) => {
      const currentKey = getQuizPoolKey(language);
      const pool = options?.preparedPool?.key === currentKey
        ? options.preparedPool
        : preparedQuizPoolRef.current?.key === currentKey
          ? preparedQuizPoolRef.current
          : prepareQuizPool(language);
      const regularCount = normalQuestionType || !count
        ? pool.regularItems.length
        : Math.min(count, pool.regularItems.length);
      const regularItems = pool.regularItems.slice(0, regularCount);
      const sessionId = createQuizSessionId();
      quizStartedAtRef.current = Date.now();
      setQuizDurationSeconds(null);
      const forceBonusAfterEach = bonusAfterEachNormalQuestion && !normalQuestionType;
      const maxBonusQuestionCount = forceBonusAfterEach
        ? regularItems.length
        : normalQuestionType
          ? 0
          : getMaxBonusQuestionCount(regularItems.length);
      const availableBonusPlans = pool.bonusPlans.filter(
        (plan) => plan.fallback && plan.index < regularItems.length,
      );
      const selectedBonusPlans = availableBonusPlans
        .filter((plan) => plan.selectedForMaxDeck)
        .slice(0, maxBonusQuestionCount)
        .map((plan) => ({
          ...plan,
          bonusId: `${sessionId}-${plan.kind}-${plan.index}`,
        }));

      // A quiz with available bonus content always gets at least one bonus,
      // even when every independent probability roll misses for this count.
      if (selectedBonusPlans.length === 0 && maxBonusQuestionCount > 0) {
        const forcedPlan = availableBonusPlans[0];
        if (forcedPlan) {
          selectedBonusPlans.push({
            ...forcedPlan,
            bonusId: `${sessionId}-${forcedPlan.kind}-${forcedPlan.index}`,
          });
        }
      }

      const selectedBonusIds = new Set(selectedBonusPlans.map((plan) => plan.bonusId));
      const items: QuizItem[] = [];
      const gptJobs: Array<{
        bonusId: string;
        kind: "sentence-order" | "category-sort";
      }> = [];
      const deckToken = bonusDeckTokenRef.current + 1;
      bonusDeckTokenRef.current = deckToken;

      regularItems.forEach((item, index) => {
        items.push(item);

        const plan = selectedBonusPlans.find((candidate) => candidate.index === index);
        const fallback = plan?.fallback;
        if (!plan || !selectedBonusIds.has(plan.bonusId) || !fallback) return;

        const anchor = regularItems[0] ?? item;
        items.push({
          card: anchor.card,
          inventoryCard: anchor.inventoryCard,
          willLearn: false,
          isBonus: true,
          bonusId: plan.bonusId,
          questionType: `bonus-${plan.kind}`,
          bonusQuestion: fallback,
        });

        if (plan.kind === "sentence-order" || plan.kind === "category-sort") {
          gptJobs.push({ bonusId: plan.bonusId, kind: plan.kind });
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
      setChestCelebrationNextPhase(null);
      setQuizCompletionTestNextIndex(null);
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
      if (!options?.deferPhase) {
        setPhase("quiz");
      }

      void Promise.all(
        gptJobs.map(async (job) => {
          if (job.kind === "sentence-order") {
            const generated = await requestSentenceBonusQuestion({
              language,
              locale,
              cards: pool.bonusCards,
            });
            if (!generated || bonusDeckTokenRef.current !== deckToken) return;

            setDeck((current) => current.map((item, itemIndex) => {
              if (!item.isBonus || item.bonusId !== job.bonusId) {
                return item;
              }
                const generatedQuestion = buildSentenceBonusFromGenerated(
                  generated,
                  pool.bonusCards,
                  job.bonusId,
                );
              if (itemIndex <= currentIndexRef.current) {
                if (
                  itemIndex === currentIndexRef.current &&
                  item.bonusQuestion.kind === "sentence-order" &&
                  normalizeBonusSentence(item.bonusQuestion.sentence) === normalizeBonusSentence(generated.sentence)
                ) {
                  return {
                    ...item,
                    bonusQuestion: {
                      ...item.bonusQuestion,
                      nativeSentence: generated.nativeSentence,
                    },
                  };
                }

                return item;
              }

              if (generatedQuestion) return { ...item, bonusQuestion: generatedQuestion };

              if (
                item.bonusQuestion.kind === "sentence-order" &&
                normalizeBonusSentence(item.bonusQuestion.sentence) === normalizeBonusSentence(generated.sentence)
              ) {
                return {
                  ...item,
                  bonusQuestion: {
                    ...item.bonusQuestion,
                    nativeSentence: generated.nativeSentence,
                  },
                };
              }

              return item;
            }));
            return;
          }

          const generated = await requestCategoryBonusQuestion({
            language,
            cards: pool.bonusCards,
          });

          if (!generated || bonusDeckTokenRef.current !== deckToken) return;

          setDeck((current) => current.map((item, itemIndex) => {
            if (!item.isBonus || item.bonusId !== job.bonusId || itemIndex <= currentIndexRef.current) return item;
            const generatedQuestion = buildCategoryBonusFromGenerated(
              generated,
              pool.bonusCards,
              job.bonusId,
            );
            return generatedQuestion ? { ...item, bonusQuestion: generatedQuestion } : item;
          }));
        }),
      );
    },
    [
      clearCardProgressFeedback,
      bonusAfterEachNormalQuestion,
      getQuizPoolKey,
      locale,
      mode,
      normalQuestionType,
      prepareQuizPool,
      stats.rank,
      stats.totalPoints,
    ],
  );

  useEffect(() => {
    preparedQuizPoolRef.current = null;
    const preparationToken = quizPoolPreparationTokenRef.current + 1;
    quizPoolPreparationTokenRef.current = preparationToken;

    if (phase !== "count" || !selectedLanguage) return;

    const language = selectedLanguage;
    const preparationTimeout = window.setTimeout(() => {
      const pool = prepareQuizPool(language);
      if (quizPoolPreparationTokenRef.current !== preparationToken) return;
      preparedQuizPoolRef.current = pool;
    }, 0);

    return () => window.clearTimeout(preparationTimeout);
  }, [phase, prepareQuizPool, selectedLanguage]);

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
    clearNormalAnswerAdvance();
    if (bonusRewardRevealTimeoutRef.current !== null) {
      window.clearTimeout(bonusRewardRevealTimeoutRef.current);
      bonusRewardRevealTimeoutRef.current = null;
    }
    if (bonusRewardAutoAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(bonusRewardAutoAdvanceTimeoutRef.current);
      bonusRewardAutoAdvanceTimeoutRef.current = null;
    }
    setShowingAnswer(false);
    setTextAnswer("");
    setTextResult("idle");
    setLastAnswerCorrect(null);
    setLastAnswer(null);
    setAiValidatingSentenceAnswer(null);
    setBonusFlightActive(false);
    setBonusRewardRevealVisible(false);
    setBonusRewardReady(false);
    setBonusPointFlightEnabled(false);
    setBonusGemRewards([]);
    bonusRewardClaimedRef.current = false;
  }, [clearCardProgressFeedback, clearNormalAnswerAdvance]);

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
        runQuizViewTransition(() => {
          setPhase("celebration");
        });
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
          const shouldResumeQuiz = true;

          try {
            await refreshStats();
            // ProgressStatsProvider updates its snapshot after inventory/profile
            // writes. Give React one task to commit that snapshot before reading
            // the rank through the ref.
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

            const previousRank = quizStartRankRef.current;
            const currentRank = statsRef.current.rank;

            if (previousRank && currentRank.minPoints > previousRank.minPoints) {
              // A rank reached during a quiz is intentionally queued. The
              // learner should finish the quiz before seeing the rank-up
              // screen, so completion/streak rewards can keep their order.
              setPendingRankUpFromRank(previousRank);
              setPendingRankUp(currentRank);
              setRankUpReturn("result");
              quizStartRankRef.current = currentRank;
              rankCheckNeededRef.current = false;
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
        const quizResults = resultsOverride ?? results;
        if (quizStartedAtRef.current !== null) {
          setQuizDurationSeconds(
            Math.max(0, Math.round((Date.now() - quizStartedAtRef.current) / 1000)),
          );
        }
        const summary = getQuizPerformanceSummary(
          mode,
          quizResults,
          selectedCount,
          chestOpened,
        );
        const simulatedStreak = quizFlowTest ? Math.max(maxStreak, 5) : maxStreak;
        const simulatedRankUp = quizFlowTest ? stats.nextRank : null;
        const queuedRankUp = pendingRankUp ?? simulatedRankUp;
        const hasRewardChest = quizFlowTest
          ? selectedCount !== null
          : summary.chestUnlocked && selectedCount !== null;

        if (quizFlowTest) {
          setMaxStreak(simulatedStreak);
        }

        if (simulatedRankUp && !pendingRankUp) {
          setPendingRankUpFromRank(stats.rank);
          setPendingRankUp(simulatedRankUp);
          setRankUpReturn("result");
        }

        const nextResultPhase =
          getQuizStreakRewardPoints(simulatedStreak) > 0
            ? "streak-reward"
            : queuedRankUp
              ? "rank-up"
              : "result-pending";

        if (hasRewardChest && selectedCount !== null) {
          setAwardedChestTier(
            quizFlowTest
              ? getChestTierByCount(selectedCount) ?? getChestTierByCount(10) ?? null
              : resolveAwardedChestTier(selectedCount) ?? null,
          );
        }

        if (resultsOverride) {
          setResults(quizResults);
        }
        setQuizCompletionNextPhase(nextResultPhase);
        runQuizViewTransition(
          () => setPhase("quiz-completion"),
          { fadeQuizTopBar: true },
        );
        return;
      }

      if (quizCompletionTest) {
        setQuizCompletionTestNextIndex(currentIndex + 1);
        runQuizViewTransition(
          () => setPhase("quiz-completion"),
          { fadeQuizTopBar: true },
        );
        return;
      }

      const nextIndex = currentIndex + 1;
      runQuizViewTransition(() => {
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setBonusRewardRevealVisible(false);
        if (bypassCelebration) {
          setLastLearned(null);
          setCelebrationBasePoints(null);
        }
        resetQuestionUi();
        setPhase("quiz");
      });
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
      pendingRankUp,
      refreshStats,
      resetQuestionUi,
      results,
      selectedCount,
      quizCompletionTest,
      quizFlowTest,
      announceQuizRankUp,
      stats.nextRank,
      stats.rank,
    ],
  );

  const queueAutoAdvance = useCallback(
    (resultsOverride?: QuizResult) => {
      if (autoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (normalAnswerAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(normalAnswerAdvanceTimeoutRef.current);
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
      if (deferredRecordTimeoutRef.current !== null) {
        window.clearTimeout(deferredRecordTimeoutRef.current);
      }
      if (normalAnswerAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(normalAnswerAdvanceTimeoutRef.current);
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
    setResultMessageOnResult(false);
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
    setChestCelebrationNextPhase(null);
    setPhase("count");
  }

  function handleStartCount(count: number, _startSplashAlreadyShown = false) {
    if (!selectedLanguage) return;
    setSelectedCount(count);
    setAwardedChestTier(null);
    const preparedPool = preparedQuizPoolRef.current?.key === getQuizPoolKey(selectedLanguage)
      ? preparedQuizPoolRef.current
      : undefined;
    runQuizViewTransition(() => {
      buildDeck(selectedLanguage, count, {
        preparedPool,
        deferPhase: quizFlowTest,
      });

      if (quizFlowTest) {
        const simulatedStreak = Math.max(maxStreak, 5);
        const simulatedRankUp = stats.nextRank;

        setMaxStreak(simulatedStreak);
        setAwardedChestTier(
          getChestTierByCount(count) ?? getChestTierByCount(10) ?? null,
        );

        if (simulatedRankUp) {
          setPendingRankUpFromRank(stats.rank);
          setPendingRankUp(simulatedRankUp);
          setRankUpReturn("result");
        }

        setQuizCompletionNextPhase(
          getQuizStreakRewardPoints(simulatedStreak) > 0
            ? "streak-reward"
            : simulatedRankUp
              ? "rank-up"
              : "result-pending",
        );
        setPhase("quiz-completion");
      }
    });
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

  const finishBonusRewardFlow = useCallback((force = false) => {
    if (!force && (
      bonusRewardFlowCompletedRef.current ||
      !bonusPointFlightDoneRef.current ||
      !bonusGemFlightDoneRef.current
    )) {
      return;
    }

    if (bonusRewardAutoAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(bonusRewardAutoAdvanceTimeoutRef.current);
      bonusRewardAutoAdvanceTimeoutRef.current = null;
    }
    bonusRewardFlowCompletedRef.current = true;
    setBonusFlightActive(false);
    void refreshStats();
    refreshLeaderboardPositions();
    if (pendingStreak) {
      transitionToStreakCelebration();
      return;
    }
    advanceQuizRef.current();
  }, [pendingStreak, refreshStats]);

  function handleBonusRewardCollect() {
    if (bonusRewardClaimedRef.current) return;

    const item = deck[currentIndex];
    if (!item || !isBonusQuizItem(item) || !showingAnswer || lastAnswerCorrect !== true) return;

    bonusRewardClaimedRef.current = true;
    setBonusFlightActive(true);
    setBonusRewardReady(false);
    setBonusPointFlightEnabled(false);
    setBonusGemRewards([]);
    bonusPointFlightDoneRef.current = true;
    bonusGemFlightDoneRef.current = true;
    bonusRewardFlowCompletedRef.current = false;
    const rewardRequestId = ++bonusRewardRequestRef.current;

    const scheduleRewardFallback = () => {
      if (bonusRewardAutoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(bonusRewardAutoAdvanceTimeoutRef.current);
      }
      bonusRewardAutoAdvanceTimeoutRef.current = window.setTimeout(() => {
        bonusRewardAutoAdvanceTimeoutRef.current = null;
        finishBonusRewardFlow(true);
      }, 2_000);
    };

    if (quizSessionId) {
      void awardQuizBonusPoints(quizSessionId, item.bonusId)
        .then((result) => {
          if (rewardRequestId !== bonusRewardRequestRef.current) return;

          const awarded = result.success && result.awarded === true;
          const rewards = awarded ? result.gemRewards ?? [] : [];

          if (result.balances) {
            bonusGemFinalBalancesRef.current = result.balances;
            prepareBonusGemDisplay(result.balances, rewards);
            updateProfileField({
              blueGems: result.balances.blue,
              greenGems: result.balances.green,
              purpleGems: result.balances.purple,
            });
          }

          bonusPointFlightDoneRef.current = !awarded && result.success;
          bonusGemFlightDoneRef.current = rewards.length === 0;
          setBonusGemRewards(rewards);
          setBonusPointFlightEnabled(!result.success || awarded);
          setBonusRewardReady(true);

          if (!awarded && result.success) {
            finishBonusRewardFlow();
          } else {
            scheduleRewardFallback();
          }
        })
        .catch(() => {
          if (rewardRequestId !== bonusRewardRequestRef.current) return;
          bonusPointFlightDoneRef.current = false;
          bonusGemFlightDoneRef.current = true;
          setBonusPointFlightEnabled(true);
          setBonusRewardReady(true);
          scheduleRewardFallback();
        });
    } else {
      bonusPointFlightDoneRef.current = false;
      bonusGemFlightDoneRef.current = true;
      setBonusPointFlightEnabled(true);
      setBonusRewardReady(true);
      scheduleRewardFallback();
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
          setBonusFlightActive(false);
          setBonusRewardRevealVisible(false);
          setBonusRewardReady(false);
          setBonusPointFlightEnabled(false);
          setBonusGemRewards([]);
          bonusPointFlightDoneRef.current = true;
          bonusGemFlightDoneRef.current = true;
          bonusRewardFlowCompletedRef.current = false;
          bonusRewardClaimedRef.current = false;
          const bonusRevealDelay = item.bonusQuestion.kind === "matching"
            ? 0
            : QUIZ_BUTTON_FEEDBACK_DURATION_MS;
          bonusRewardRevealTimeoutRef.current = window.setTimeout(() => {
            bonusRewardRevealTimeoutRef.current = null;
            runQuizViewTransition(() => setBonusRewardRevealVisible(true));
          }, bonusRevealDelay);
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
    clearNormalAnswerAdvance();
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
    const correctAnswer = item.questionType === "group"
      ? item.question.options.find(
          (option) => option.card.id === item.question.correctOptionId,
        )?.card.term ?? ""
      : item.question.correctAnswer;
    const answerFeedbackPlayedOnPress = answer.trim().length > 0 && [
      "choice",
      "group",
      "listening",
      "definition",
      "true-false",
    ].includes(item.questionType);

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

          if (!answerFeedbackPlayedOnPress) {
            playSoundEffect("correct");
            vibrate("correct");
          }
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

        const showCardProgress = startCardProgressFeedback(item, isCorrect);

        if (!answerFeedbackPlayedOnPress) {
          playSoundEffect(isCorrect ? "correct" : "incorrect");
          vibrate(isCorrect ? "correct" : "incorrect");
        }

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
        const shouldShowStreak = nextStreak > 0 && nextStreak % 5 === 0;
        if (shouldShowStreak) {
          setPendingStreak(true);
        }

        if (!showCardProgress && isCorrect) {
          clearNormalAnswerAdvance();
          normalAnswerAdvanceTimeoutRef.current = window.setTimeout(() => {
            normalAnswerAdvanceTimeoutRef.current = null;
            // Keep the streak screen after answer feedback. A learned card
            // first goes through its own celebration and hands off below.
            if (shouldShowStreak && !willLearn) {
              transitionToStreakCelebration();
              return;
            }
            // The answer write is intentionally independent from the visual
            // flow. Advance through the latest quiz handler as soon as answer
            // feedback settles so a slow persistence/stats request cannot
            // delay the learned-card celebration.
            advanceQuizRef.current();
          }, NORMAL_ANSWER_AUTO_ADVANCE_DELAY_MS);
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

  function completeCardProgressReveal() {
    const shouldShowStreak = pendingStreak;
    if (shouldShowStreak) {
      runQuizViewTransition(() => {
        clearCardProgressFeedback();
        setPendingStreak(false);
        setPhase("streak-celebration");
      });
      return;
    }

    // Keep the correct-answer screen mounted until advanceQuiz starts the
    // transition. Clearing it first would expose the previous question for a
    // frame and make the next transition start from that stale UI.
    advanceQuiz();
  }

  function handleNext() {
    const wrongAnswerFeedbackOpen = showingAnswer && lastAnswerCorrect === false;

    if (cardProgressFeedback) {
      completeCardProgressReveal();
      return;
    }
    if ((pendingStreak || bonusFlightActive) && !wrongAnswerFeedbackOpen) return;
    clearNormalAnswerAdvance();
    clearCardProgressFeedback();
    advanceQuiz();
  }

  function handleContinueFromCelebration() {
    if (pendingStreak) {
      runQuizViewTransition(() => {
        // The learned-card screen has already been shown. Clear its marker
        // before mounting streak so it cannot reopen after the streak ends.
        setLastLearned(null);
        setCelebrationBasePoints(null);
        setPendingStreak(false);
        setPhase("streak-celebration");
      });
      return;
    }
    advanceQuiz({ bypassCelebration: true });
  }

  function handleRestart() {
    // Replay always returns to the count selection screen so the learner can
    // choose a fresh deck size instead of silently repeating the old one.
    setSelectedCount(null);
    setChestOpened(false);
    setAwardedChestTier(null);
    setResultMessageOnResult(false);
    setPhase("count");
  }

  function handleExit() {
    navigateWithRouteTransition(() => router.push("/"));
  }

  function handleChestComplete() {
    if (chestOpened) {
      setPhase(getQuizStreakRewardPoints(maxStreak) > 0 ? "streak-reward" : "result-pending");
      return;
    }

    setChestOpened(true);
    setPhase(getQuizStreakRewardPoints(maxStreak) > 0 ? "streak-reward" : "result-pending");
  }

  function handleStreakRewardComplete() {
    // Returning through result-pending lets the streak award finish before a
    // queued rank-up is presented.
    setPhase("result-pending");
  }

  function handleQuizCompletionComplete() {
    if (quizCompletionTestNextIndex !== null) {
      const nextIndex = quizCompletionTestNextIndex;
      setQuizCompletionTestNextIndex(null);
      runQuizViewTransition(() => {
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setBonusRewardRevealVisible(false);
        resetQuestionUi();
        setPhase("quiz");
      });
      return;
    }

    if (quizCompletionNextPhase === "streak-reward") {
      runQuizViewTransition(
        () => setPhase("streak-reward"),
        { delayIncomingMs: QUIZ_FLOW_INCOMING_DELAY_MS },
      );
      return;
    }

    if (quizCompletionNextPhase === "rank-up" && pendingRankUp) {
      if (!quizFlowTest) {
        announceQuizRankUp(pendingRankUp);
      }
      setResultMessageOnResult(true);
      setRankUpReturn("result");
      runQuizViewTransition(
        () => setPhase("rank-up"),
        { delayIncomingMs: QUIZ_FLOW_INCOMING_DELAY_MS },
      );
      return;
    }

    if (quizCompletionNextPhase === "result-pending") {
      runQuizViewTransition(
        () => {
          setResultMessageOnResult(true);
          setPhase("result-pending");
        },
        { delayIncomingMs: QUIZ_FLOW_INCOMING_DELAY_MS },
      );
      return;
    }

    runQuizViewTransition(
      () => setPhase("result-pending"),
      { delayIncomingMs: QUIZ_FLOW_INCOMING_DELAY_MS },
    );
  }

  function handleResultChestFlowComplete() {
    if (awardedChestTier) {
      setChestOpened(true);
    }
    setAwardedChestTier(null);
    if (mode === "learned") {
      setSelectedCount(null);
    }
    setPhase("count");
  }

  async function prepareChestReward(tier: ChestTierDefinition["tier"]): Promise<ChestRewardOutcome | null> {
    if (quizFlowTest) {
      return createChestRewardPreview(tier);
    }

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

    if (quizFlowTest) {
      awardedStreakSessionRef.current = quizSessionId;
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
  }, [maxStreak, phase, quizFlowTest, quizSessionId, refreshStats, updateProfileField, user]);

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
      if (pendingRankUp) {
        if (!quizFlowTest) {
          announceQuizRankUp(pendingRankUp);
        }
        setResultMessageOnResult(true);
        setRankUpReturn("result");
        setPhase("rank-up");
        return;
      }

      const startRank = quizStartRankRef.current;
      const didRankUp = startRank !== null && stats.rank.minPoints > startRank.minPoints;

      if (didRankUp) {
        if (!quizFlowTest) {
          announceQuizRankUp(stats.rank);
        }
        setPendingRankUpFromRank(startRank);
        setPendingRankUp(stats.rank);
        setRankUpReturn("result");
        setResultMessageOnResult(true);
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
    pendingRankUp,
    requiresStreakAward,
    announceQuizRankUp,
    quizFlowTest,
    stats.rank,
    stats.totalPoints,
    user?.id,
  ]);

  if ((!hydrated || cloudLoading || !cloudInventoryReady) && !canRenderPersistedQuizSetup) {
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

  const useCssQuizTransition =
    !supportsViewTransition || useCssQuizTransitionRef.current;

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
          <QuizCountSelection
            mode={mode}
            availableCount={availableCards.length}
            locked={interactionLocked}
            onSelect={handleStartCount}
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

  if (phase === "quiz-completion") {
    return (
      <QuizCompletionProgressView
        enterWithCss={useCssQuizTransition}
        onComplete={handleQuizCompletionComplete}
      />
    );
  }

  if (phase === "celebration" && lastLearned) {
    return (
      <CelebrationView
        card={lastLearned}
        basePoints={celebrationBasePoints ?? stats.totalPoints}
        enterWithCss={useCssQuizTransition}
        onContinue={handleContinueFromCelebration}
      />
    );
  }

  if (phase === "result") {
    const achievementCards = getQuizAchievementCards(results);
    const currentNormalItems = deck.filter((item) => !isBonusQuizItem(item));
    const nearLearnedCards = new Set(
      currentNormalItems
        .filter((item) => {
          if (mode !== "active" || item.willLearn || item.inventoryCard.status === "learned") {
            return false;
          }

          const requirement = getTierRequirement(item.card.tier);
          return item.inventoryCard.correctCount + 1 >= Math.max(1, requirement - 1);
        })
        .map((item) => item.card.id),
    ).size;
    const remainingActiveCards = selectedLanguage
      ? filterInventoryCards({
          cards,
          language: selectedLanguage,
          status: "active",
        }).length
      : 0;
    const advancedCardProgress = Object.fromEntries(
      achievementCards.advancedCards.map((card) => {
        const quizItem = deck.find((item) => item.card.id === card.id && item.isBonus !== true);
        const requirement = getTierRequirement(card.tier);
        const progressAfterAnswer = (quizItem?.inventoryCard.correctCount ?? 0) + 1;
        return [card.id, Math.min(requirement - 1, progressAfterAnswer)];
      }),
    );

    return (
      <QuizViewportOverlay
        learnPagePhase="result"
        overlay="result"
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-background p-4 max-lg:bottom-0 max-lg:top-0 max-lg:p-0 lg:bottom-0 lg:top-16"
      >
        <div className="flex h-full w-full max-w-3xl items-center justify-center">
          <ResultFlowView
            mode={mode}
            results={results}
            selectedCount={selectedCount}
            quizSessionId={quizSessionId}
            quizDurationSeconds={quizDurationSeconds ?? 0}
            chestOpened={chestOpened}
            showChestRewardGate
            chestTier={awardedChestTier}
            chestTotalPoints={stats.totalPoints}
            onChestRewardReady={awardedChestTier
              ? () => prepareChestReward(awardedChestTier.tier)
              : undefined}
            onContinue={handleResultChestFlowComplete}
            streakRewardStreak={getRewardableQuizStreak(maxStreak)}
            streakRewardPoints={getQuizStreakRewardPoints(maxStreak)}
            locked={false}
            showResultMessage={resultMessageOnResult}
            learnedCards={achievementCards.learnedCards}
            advancedCards={achievementCards.advancedCards}
            advancedCardProgress={advancedCardProgress}
            remainingActiveCards={remainingActiveCards}
            nearLearnedCards={nearLearnedCards}
            nearLevelUpCards={achievementCards.advancedCards.length}
            rankProgressPercent={stats.rankProgressPercent}
            pointsToNextRank={stats.pointsToNextRank}
            currentRankIcon={stats.rank.icon}
            nextRankIcon={stats.nextRank?.icon ?? null}
            gainedGems={0}
            onResultMessageComplete={() => setResultMessageOnResult(false)}
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
        enterWithCss={useCssQuizTransition}
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
        onComplete={handleStreakRewardComplete}
      />
    );
  }

  if (phase === "chest-celebration") {
    const achievementCards = getQuizAchievementCards(results);
    const advancedCardProgress = Object.fromEntries(
      achievementCards.advancedCards.map((card) => {
        const quizItem = deck.find((item) => item.card.id === card.id && item.isBonus !== true);
        const requirement = getTierRequirement(card.tier);
        const progressAfterAnswer = (quizItem?.inventoryCard.correctCount ?? 0) + 1;
        return [card.id, Math.min(requirement - 1, progressAfterAnswer)];
      }),
    );

      return (
        <QuizViewportOverlay
          overlay="result"
          learnPagePhase="result"
          className="animate-screen-pop fixed inset-0 z-[100] flex items-center justify-center bg-background p-0"
        >
          <ChestCelebrationView
            learnedCards={achievementCards.learnedCards}
            advancedCards={achievementCards.advancedCards}
            advancedCardProgress={advancedCardProgress}
            onComplete={() => {
              const nextPhase = chestCelebrationNextPhase ?? "chest";
              setChestCelebrationNextPhase(null);
              setPhase(nextPhase);
            }}
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

  const isQuizPhase = phase === "quiz";

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

  const regularProgress = getRegularQuizProgress(deck, currentIndex);
  const mobileQuestionPrompt = isBonusQuizItem(item)
    ? getBonusCopy(locale).intro
    : item.questionType === "listening"
      ? t("quiz.listeningPrompt")
      : item.questionType === "definition"
        ? t("quiz.wordLearningQuestion")
        : item.questionType === "sentence-completion"
          ? t("quiz.sentenceCompletionPrompt")
          : item.questionType === "group"
            ? t("quiz.groupMeaningPrompt")
          : item.questionType === "true-false"
            ? t("games.wordChallenge.question")
            : item.questionType === "text"
              ? t("quiz.wordLearningQuestion")
              : t("quiz.recallPrompt");
  const isCardFirstQuestion =
    !isBonusQuizItem(item) &&
    (item.questionType === "choice" ||
      item.questionType === "listening" ||
      item.questionType === "definition" ||
      item.questionType === "true-false" ||
      item.questionType === "group");
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
  const textMascotAnimation =
    item.questionType === "text"
      ? getNextTextMascotAnimation(`${currentIndex}:${item.card.id}`)
      : undefined;

  return (
    <>
      <MobileQuizTopBar
        currentIndex={regularProgress.current - 1}
        total={regularProgress.total}
        questionPrompt={mobileQuestionPrompt}
        questionPromptAccent={item.questionType === "definition" || item.questionType === "text"}
        questionPromptIsBonus={isBonusQuizItem(item)}
        onExit={handleExit}
        entryAnimated={false}
      />
      <div
        className="quiz-transition-viewport relative mx-auto flex h-auto w-full max-w-5xl flex-col justify-center overflow-x-hidden overflow-y-hidden bg-background max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(5rem+15px+env(safe-area-inset-bottom))] max-lg:top-[var(--app-header-height)] max-lg:max-w-none max-lg:justify-start max-lg:overflow-hidden max-lg:overscroll-none lg:h-full"
        data-learn-quiz-page="quiz"
      >
        <div
          key={`quiz-flow-${currentIndex}-${isBonusQuizItem(item) ? item.bonusId : item.card.id}`}
          className={cn(
            useCssQuizTransition && "quiz-flow-enter-right",
            "flex min-h-full w-full flex-col items-center justify-center gap-3 px-4 py-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:px-0 lg:py-0",
            mobileQuestionPrompt && "max-lg:pt-[3.5rem]",
          )}
          data-quiz-mobile-layout={item.questionType}
        >
          <div
            className={cn(
              "flex w-full max-w-md flex-col justify-center gap-3 lg:order-1 lg:col-start-1 lg:row-start-1 lg:max-w-none lg:gap-4",
              isBonusQuizItem(item)
                ? "order-1 max-lg:min-h-0 max-lg:flex-1 max-lg:pb-0"
                : cn(isCardFirstQuestion ? "order-3" : "order-1", "max-lg:pb-3"),
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
                   language={item.card.language}
                   showingAnswer={showingAnswer}
                   answerAccepted={lastAnswerCorrect}
                   wasSkipped={isBonusQuizItem(item) && lastAnswer === ""}
                   canAdvance={!pendingStreak && !bonusFlightActive}
                  rewardReady={bonusRewardReady}
                  showPointFlight={bonusPointFlightEnabled}
                  totalPoints={Math.max(stats.totalPoints, quizBasePointsRef.current + bonusPointsDisplayed)}
                  scorePulse={bonusScorePulse}
                  gemBalances={bonusGemDisplayBalances}
                  gemPulse={bonusGemPulse}
                  gemRewards={bonusGemRewards}
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
                    bonusPointFlightDoneRef.current = true;
                    finishBonusRewardFlow();
                  }}
                  onGemArrive={handleBonusGemArrive}
                  onGemFlightComplete={() => {
                    bonusGemFlightDoneRef.current = true;
                    finishBonusGemDisplay(bonusGemFinalBalancesRef.current);
                    finishBonusRewardFlow();
                  }}
                  rewardRevealVisible={bonusRewardRevealVisible}
                  onRewardCollect={handleBonusRewardCollect}
                />
              ) : item.questionType === "choice" ? (
                <ChoiceQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  selectedAnswer={lastAnswer}
                  promptClassName="max-lg:hidden"
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={false}
                />
              ) : item.questionType === "group" ? (
                <GroupQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  selectedAnswer={lastAnswer}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={false}
                />
              ) : item.questionType === "listening" ? (
                <ListeningQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  selectedAnswer={lastAnswer}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={false}
                />
              ) : item.questionType === "definition" ? (
                <DefinitionQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  selectedAnswer={lastAnswer}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={false}
                  isFirstQuestion={currentIndex === 0}
                />
              ) : item.questionType === "true-false" ? (
                <TrueFalseQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  selectedAnswer={lastAnswer}
                  promptClassName="max-lg:hidden"
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  rerollAction={rerollAction}
                  onNext={handleNext}
                  showNextButton={false}
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
                  showNextButton={false}
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
                  mascotAnimation={textMascotAnimation}
                   showNextButton={false}
                  isFirstQuestion={currentIndex === 0}
                />
              )}
            </div>
          </div>

        </div>

        <div
          className="pointer-events-none absolute inset-0 z-50"
          data-quiz-transition-action-host
        />
      </div>

      {cardProgressFeedback ? (
        <CardProgressReveal
          item={item}
          feedback={cardProgressFeedback}
          enterWithCss={useCssQuizTransition}
          onContinue={completeCardProgressReveal}
        />
      ) : null}

        <MobileQuizFeedback
          isOpen={
            showingAnswer &&
            lastAnswerCorrect !== null &&
            !lastAnswerCorrect
          }
          isCorrect={lastAnswerCorrect ?? false}
          isBonus={isBonusQuizItem(item)}
          isText={item.questionType === "text"}
          correctAnswer={
            item.questionType === "group"
              ? item.question.options.find(
                  (option) => option.card.id === item.question.correctOptionId,
                )?.card.term
              : getFeedbackCorrectAnswer(item)
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

export function CardProgressReveal({
  item,
  feedback,
  enterWithCss,
  onContinue,
}: {
  item: QuizCardProgressRevealItem;
  feedback: QuizCardProgressFeedback;
  enterWithCss: boolean;
  onContinue: () => void;
}) {
  const t = useT();
  const [hasStarted, setHasStarted] = useState(false);
  const [progressColorSettled, setProgressColorSettled] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  const progressCount = hasStarted ? feedback.targetCount : feedback.baseCount;

  useEffect(() => {
    return () => {
      if (progressTimerRef.current !== null) window.clearTimeout(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const idleVibrationTimer = window.setTimeout(() => vibrate("tap"), 720);
    return () => window.clearTimeout(idleVibrationTimer);
  }, []);

  function handleContinue() {
    if (hasStarted) {
      if (progressTimerRef.current !== null) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      onContinue();
      return;
    }

    setHasStarted(true);
    vibrate("result");
    playSoundEffect("points");

    progressTimerRef.current = window.setTimeout(() => {
      progressTimerRef.current = null;
      setProgressColorSettled(true);
    }, QUIZ_CARD_PROGRESS_ADVANCE_DURATION_MS);
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-[80] flex cursor-pointer items-center justify-center overflow-y-auto bg-background px-5 py-8 text-center",
        hasStarted && "animate-quiz-tier-background-flash",
      )}
      style={{ "--quiz-tier-flash-color": TIER_RAY_COLOR_VARIABLES[item.card.tier] } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={t("quiz.tapToContinue")}
      data-no-tap-vibrate
      onClick={handleContinue}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleContinue();
        }
      }}
      data-quiz-card-progress-started={hasStarted ? "true" : undefined}
      data-quiz-card-progress-reveal
    >
      <div className={cn(
        enterWithCss && "quiz-flow-enter-right",
        "relative z-10 flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4",
      )}>
        <div
          className={cn(
            "relative my-2 aspect-[3/4] w-[min(58vw,15rem)] max-w-full sm:my-4 sm:w-[min(30vw,17rem)]",
            !hasStarted && "animate-quiz-card-idle-attention",
          )}
          style={
            !hasStarted
              ? { animationDuration: `${QUIZ_CARD_PROGRESS_IDLE_ROTATION_DURATION_MS}ms` }
              : undefined
          }
        >
          <div
            className={cn(
              "relative z-10 h-full w-full",
              hasStarted && !progressColorSettled && "animate-quiz-card-level-up-grow-hold",
              progressColorSettled && "animate-quiz-card-level-up-shrink",
            )}
            onAnimationEnd={(event) => {
              if (event.animationName === "quiz-card-level-up-shrink") {
                onContinue();
              }
            }}
          >
            <VocabularyCardView
              card={item.card}
              inventory={item.inventoryCard}
              owned
              initialFace="front"
              face="front"
              flippable={false}
              showActions={false}
              footerMode="progress"
              footerProgressCount={progressCount}
              progressAnimationActive={hasStarted && !progressColorSettled}
              className="h-full w-full min-h-0 max-w-full max-sm:min-h-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileQuizCard({
  item,
  compact = false,
  progressAnimation = false,
  face,
  feedbackStage,
  footerMode,
  footerProgressCount,
}: {
  item: QuizItem;
  compact?: boolean;
  progressAnimation?: boolean;
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
  const [lockedTapCount, setLockedTapCount] = useState(0);
  const isMobileViewport = useSyncExternalStore(
    (callback) => {
      window.addEventListener("resize", callback);
      return () => window.removeEventListener("resize", callback);
    },
    () => window.innerWidth < 1024,
    () => false,
  );
  const isFeedbackActive = feedbackStage !== "idle";
  const isLockedBeforeAnswer = isMobileViewport && face === "back" && !isFeedbackActive;

  function handleLockedCardPress() {
    if (!isLockedBeforeAnswer) return;

    setLockedTapCount((current) => current + 1);
    vibrate("incorrect");
  }

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
  const centeredCardScale = compact
    ? QUIZ_CARD_CENTER_SCALE / QUIZ_CARD_COMPACT_SCALE
    : QUIZ_CARD_CENTER_SCALE;
  const floatingStyle: CSSProperties | undefined = floatingFrame
    ? {
        left: floatingFrame.origin.left,
        top: floatingFrame.origin.top,
        width: floatingFrame.origin.width,
        height: floatingFrame.origin.height,
        transformOrigin: "center",
        transform: isCentered && centerOffset
          ? `translate3d(${centerOffset.x}px, ${centerOffset.y}px, 0) scale(${centeredCardScale})`
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
      key={lockedTapCount}
      className={cn(
        "h-full w-full transform-gpu transition-transform duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        // Above the question UI, below every quiz-wide overlay (streak, rewards, results).
        floatingFrame ? "fixed z-20" : "relative",
        isLockedBeforeAnswer && lockedTapCount > 0 && "animate-quiz-card-locked-shake",
      )}
      data-quiz-card-feedback={feedbackStage}
      data-quiz-card-locked={isLockedBeforeAnswer ? "true" : "false"}
      data-quiz-card-locked-tap-count={lockedTapCount}
      aria-disabled={isLockedBeforeAnswer || undefined}
      onClick={isLockedBeforeAnswer ? handleLockedCardPress : undefined}
      style={floatingStyle}
    >
      <div
        className={cn(
          "h-full w-full",
          progressAnimation && floatingFrame !== null && isCentered && "animate-quiz-card-progress-void",
        )}
        data-quiz-card-progress-animation={
          progressAnimation && floatingFrame !== null && isCentered ? "true" : undefined
        }
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
    </div>
  );

  return (
    <div
      ref={slotRef}
      className={cn(
        "relative aspect-[3/4] w-[min(285px,calc((100vw-3rem)/2))] max-w-full shrink-0",
        compact && "origin-bottom scale-[0.78]",
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

function createSeededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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
  learnedCards: VocabularyCard[] = [],
): BonusQuestion | null {
  if (kind === "matching") {
    return buildMatchingBonusQuestion(cards, locale, seed, learnedCards);
  }

  if (kind === "sentence-order") {
    return buildFallbackSentenceOrderQuestion(cards, seed, locale);
  }

  if (kind === "category-sort") {
    return buildFallbackCategoryBonusQuestion(language, seed);
  }

  return buildImposterBonusQuestion(language, seed);
}

function isBonusQuizItem(item: QuizItem): item is BonusQuizItem {
  return item.isBonus === true;
}

function normalizeBonusSentence(value: string) {
  return value
    .trim()
    .replace(/\s+([,.;!?])/gu, "$1")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase();
}

function getFeedbackCorrectAnswer(item: QuizItem): string | undefined {
  if (isBonusQuizItem(item)) {
    const question = item.bonusQuestion;

    if (question.kind === "imposter") {
      return question.options.find((option) => option.id === question.correctOptionId)?.text;
    }

    if (question.kind === "sentence-order") {
      const tokenById = new Map(
        question.tokens.map((token) => [token.id, token.text]),
      );
      const acceptedOrder = question.acceptedTokenOrders[0] ?? [];
      const sentence = acceptedOrder
        .map((tokenId) => tokenById.get(tokenId))
        .filter((token): token is string => Boolean(token))
        .join(" ");

      return sentence || undefined;
    }

    return undefined;
  }

  switch (item.questionType) {
    case "choice":
    case "definition":
    case "listening":
    case "text":
    case "sentence-completion":
      return item.question.correctAnswer;
    case "group":
      return item.question.options.find(
        (option) => option.card.id === item.question.correctOptionId,
      )?.card.term;
    case "true-false":
      return item.question.actualMeaning;
    default:
      return undefined;
  }
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

function useSpeakQuizTermAfterEntry(
  card: Pick<VocabularyCard, "id" | "term" | "language">,
  voiceProfile: ReturnType<typeof getCharacterVoiceProfile>,
) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      speakCardTerm(card.term, card.language, voiceProfile.gender, voiceProfile.age);
    }, QUIZ_QUESTION_ENTRY_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [card.id, card.language, card.term, voiceProfile.age, voiceProfile.gender]);
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
  availableCount,
  selectedCount,
  locked = false,
  onPrepare,
  onSelect,
}: {
  mode: PracticeMode;
  availableCount: number;
  selectedCount: number | null;
  locked?: boolean;
  onPrepare?: (count: number) => void;
  onSelect: (
    count: number,
    options?: { startSplashAlreadyShown?: boolean },
  ) => void;
  onBack?: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const useSuperWater = canUseSuperWater(locale);
  const showChestTiers = mode === "active";
  const [launch, setLaunch] = useState<CountLaunch | null>(null);
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);
  const [hideLaunchCover, setHideLaunchCover] = useState(false);
  const [hideCountSelection, setHideCountSelection] = useState(false);
  const [introPhase, setIntroPhase] = useState<CountIntroPhase>("intro");
  const [introStarted, setIntroStarted] = useState(false);
  const [dimLockedOptions, setDimLockedOptions] = useState(false);
  const [scatterMotion, setScatterMotion] = useState<Record<number, CountScatterMotion>>({});
  const launchTimerRef = useRef<number | null>(null);
  const scatterFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId: number | null = null;
    let cancelled = false;

    const startWhenPageEntryIsFinished = () => {
      if (cancelled) return;

      if (document.documentElement.dataset.routeTransition) {
        frameId = window.requestAnimationFrame(startWhenPageEntryIsFinished);
        return;
      }

      // Give the route shell two paints after its curtain is gone. The intro
      // stays mounted but invisible until this point, so route-content
      // measurement cannot deadlock while the animation is being prepared.
      frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(() => {
          if (!cancelled) setIntroStarted(true);
        });
      });
    };

    frameId = window.requestAnimationFrame(startWhenPageEntryIsFinished);

    return () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!introStarted) return;

    const buttonsTimer = window.setTimeout(
      () => setIntroPhase("buttons"),
      COUNT_INTRO_HOLD_DURATION_MS,
    );
    const closeTimer = window.setTimeout(
      () => setIntroPhase("closing"),
      COUNT_INTRO_HOLD_DURATION_MS + COUNT_BUTTONS_ENTER_TOTAL_DURATION_MS,
    );
    const readyTimer = window.setTimeout(
      () => setIntroPhase("ready"),
      COUNT_INTRO_HOLD_DURATION_MS +
        COUNT_BUTTONS_ENTER_TOTAL_DURATION_MS +
        COUNT_INTRO_EXIT_DURATION_MS,
    );

    return () => {
      window.clearTimeout(buttonsTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(readyTimer);
    };
  }, [introStarted]);

  useEffect(() => {
    if (introPhase !== "ready") {
      setDimLockedOptions(false);
      return;
    }

    let frameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(() => {
        setDimLockedOptions(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [introPhase]);

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
    onPrepare?.(count);
    setHideLaunchCover(false);
    setHideCountSelection(false);
    launchTimerRef.current = window.setTimeout(() => {
      setShowLaunchSplash(true);
      launchTimerRef.current = null;
    }, COUNT_SELECTION_COVER_DURATION_MS);
  }

  return (
    <div
      data-quiz-count-selection
      data-quiz-count-ready={introStarted && introPhase === "ready" ? "true" : undefined}
      data-quiz-count-launching={launch ? "true" : undefined}
      className={cn(
        "relative isolate flex h-full min-h-[calc(100dvh-var(--app-header-height))] w-full flex-col overflow-hidden bg-background-card",
        launch && "overflow-visible",
        hideCountSelection && "pointer-events-none opacity-0",
      )}
    >
      {introPhase !== "ready" ? (
        <div
          data-quiz-count-intro
          className={cn(
            "quiz-count-intro fixed inset-0 z-[100] min-h-[100dvh] text-white",
            mode === "active" ? "bg-action-learn" : "bg-action-learned",
            useSuperWater && "font-super-water",
            !introStarted && "quiz-count-intro--pending",
            introPhase === "closing" && "quiz-count-intro--closing",
          )}
        >
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="flex w-full max-w-4xl flex-col items-center gap-5 sm:gap-7">
              <h2
                className={cn(
                  "max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] font-bold leading-[0.95]",
                  introStarted && "mission-details-overlay__item",
                )}
                style={introStarted ? { animationDelay: "260ms" } : undefined}
              >
                {formatSuperWaterText(locale, t("quiz.chooseCountTitle"))}
              </h2>
              {locked ? (
                <p
                  className={cn(
                    "text-base font-semibold text-white/90 sm:text-xl",
                    introStarted && "mission-details-overlay__item",
                  )}
                  style={introStarted ? { animationDelay: "520ms" } : undefined}
                >
                  {formatSuperWaterText(locale, t("quiz.loadingDescription"))}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {introStarted && introPhase !== "intro" ? <div className="quiz-count-options-enter relative z-[110] grid min-h-0 flex-1 grid-cols-2">
        {QUIZ_COUNT_OPTIONS.map((count, index) => {
          const unavailable = locked || count > availableCount;
          const disabled =
            unavailable ||
            Boolean(launch) ||
            introPhase !== "ready";
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
                "pointer-events-auto flex flex-col items-center justify-center gap-1 border border-white/10 p-6 text-center text-white transition-[background-color,border-color,color,filter,opacity] duration-500 ease-out hover:brightness-110 disabled:cursor-not-allowed sm:p-8",
                colorClass,
                useSuperWater && "font-super-water",
                introPhase !== "ready" && "quiz-count-option-position-enter",
                launch && launch.count !== count && "relative z-[80] pointer-events-none disabled:opacity-100",
                launch && launch.count === count && "opacity-0",
              )}
              style={
                {
                  opacity:
                    !launch && introPhase === "ready" && dimLockedOptions
                      ? unavailable
                        ? 0.4
                        : 1
                      : undefined,
                  transition:
                    "opacity 500ms ease-out, background-color 500ms ease-out, border-color 500ms ease-out, color 500ms ease-out, filter 500ms ease-out",
                  "--quiz-count-option-delay": `${index * COUNT_BUTTON_STAGGER_DURATION_MS}ms`,
                  ...(launch && launch.count !== count
                    ? {
                        transform: `translate3d(${scatterMotion[count]?.x ?? 0}px, ${scatterMotion[count]?.y ?? 0}px, 0) rotate(${scatterMotion[count]?.rotation ?? 0}deg)`,
                        transformOrigin: "50% 70%",
                        willChange: "transform",
                      }
                    : {}),
                } as CSSProperties
              }
            >
                <span className="inline-block -translate-y-1 text-2xl font-medium uppercase tracking-wide opacity-85 sm:-translate-y-2 sm:text-4xl">
                  {formatSuperWaterUppercaseText(locale, t("quiz.countLabel"))}
                </span>
              <span className={QUIZ_COUNT_IMAGE_CIRCLE_CLASS}>
                <Image
                  src={QUIZ_COUNT_IMAGE_PATHS[count] ?? QUIZ_COUNT_IMAGE_PATHS[10]}
                  alt={String(count)}
                  width={384}
                  height={275}
                  className="h-auto w-full object-contain"
                />
              </span>
              {showChestTiers && previewPair ? (
                <div className="mt-4 flex w-full translate-y-1 items-start justify-center gap-1 sm:mt-5 sm:translate-y-2 sm:gap-3">
                  {previewPair.map((tier) => (
                    <span
                      key={tier}
                      className="flex w-1/2 max-w-40 items-center justify-center sm:max-w-56"
                    >
                      <ChestIcon tier={tier} className="size-14 shrink-0 sm:size-24" />
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex size-[clamp(7rem,18vw,10rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full text-white"
          data-quiz-learning-count
          aria-label={`${formatNumber(locale, availableCount)} ${t("quiz.countLabel")}`}
        >
          <span
            className={cn(
              "quiz-count-option-enter flex flex-col items-center justify-center gap-1 text-[clamp(2rem,5.5vw,3.75rem)] font-bold leading-none",
              useSuperWater && "font-super-water",
            )}
            style={{
              "--quiz-count-option-delay": `${COUNT_CENTER_ENTER_DELAY_MS}ms`,
            } as CSSProperties}
          >
            <Image
              src="/quiz/cards_icon3.png"
              alt=""
              width={128}
              height={128}
              className="size-[clamp(4rem,9vw,6rem)] shrink-0 object-contain"
              aria-hidden="true"
            />
            <span>{formatNumber(locale, availableCount)}</span>
          </span>
        </div>
      </div> : null}
      {launch && !hideLaunchCover
        ? createPortal(
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none fixed z-[70] flex flex-col items-center justify-center gap-1 border border-white/10 text-center text-white animate-quiz-count-cover",
                launch.colorClass,
                useSuperWater && "font-super-water",
              )}
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
                <span className="inline-block -translate-y-1 text-2xl font-medium uppercase tracking-wide opacity-85 sm:-translate-y-2 sm:text-4xl">
                  {formatSuperWaterUppercaseText(locale, t("quiz.countLabel"))}
                </span>
                <span className={QUIZ_COUNT_IMAGE_CIRCLE_CLASS}>
                  <Image
                    src={QUIZ_COUNT_IMAGE_PATHS[launch.count] ?? QUIZ_COUNT_IMAGE_PATHS[10]}
                    alt={String(launch.count)}
                    width={384}
                    height={275}
                    className="h-auto w-full object-contain"
                  />
                </span>
                {launch.chestTiers ? (
                  <div className="mt-4 flex w-full translate-y-1 items-start justify-center gap-1 sm:mt-5 sm:translate-y-2 sm:gap-3">
                    {launch.chestTiers.map((tier) => (
                      <span
                        key={tier}
                        className="flex w-1/2 max-w-40 items-center justify-center sm:max-w-56"
                      >
                        <ChestIcon tier={tier} className="size-14 shrink-0 sm:size-24" />
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
      {launch && showLaunchSplash ? (
        <QuizStartSplash
          onCovered={() => {
            setHideLaunchCover(true);
            setHideCountSelection(true);
          }}
          onComplete={() => {
            onSelect(launch.count, { startSplashAlreadyShown: true });
          }}
        />
      ) : null}
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

type CountIntroPhase = "intro" | "buttons" | "closing" | "ready";

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
  const { locale } = useLocale();
  const t = useT();
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
    <div
      className="rounded-lg border border-transparent bg-transparent p-3 max-sm:p-2 sm:p-5 max-lg:hidden"
      data-quiz-progress-header
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {bonusLabel ?? (item.questionType === "text"
            ? t("quiz.learningQuizBadge")
            : item.questionType === "definition"
              ? t("quiz.definitionBadge")
            : item.questionType === "sentence-completion"
              ? t("quiz.sentenceCompletionBadge")
              : item.questionType === "group"
                ? t("quiz.groupMeaningPrompt")
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

export function MobileQuizTopBar({
  currentIndex,
  total,
  questionPrompt,
  questionPromptAccent = false,
  questionPromptIsBonus = false,
  onExit,
  entryAnimated = false,
}: {
  currentIndex: number;
  total: number;
  questionPrompt: string | null;
  questionPromptAccent?: boolean;
  questionPromptIsBonus?: boolean;
  onExit: () => void;
  entryAnimated?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const quizProgress = Math.min(100, ((currentIndex + 1) / total) * 100);

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-[60] flex h-16 items-center gap-3 bg-background px-4 text-white lg:hidden",
          entryAnimated && "mission-details-overlay__item",
        )}
        data-quiz-first-question-topbar={entryAnimated ? "true" : undefined}
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
          <div className="relative mr-[14px]">
            <Progress
              value={quizProgress}
              className="h-[18px] rounded-full bg-[#262626]"
              indicatorClassName="bg-amber-400 transition-[width] duration-300 ease-out"
              indicatorOverlayClassName="left-[5px] right-[5px] top-[calc(50%_-_3px)] bottom-auto h-[5px] -translate-y-1/2 rounded-full bg-white/50"
            />
          </div>
        </div>

      </div>

      {questionPrompt ? (
        <div
          className={cn(
            "fixed inset-x-0 top-[var(--app-header-height)] z-[55] flex h-14 items-center bg-background px-4 py-1.5 lg:hidden",
            entryAnimated && "mission-details-overlay__item",
          )}
          data-mobile-quiz-question-prompt
        >
          <div className="flex w-fit max-w-full items-center gap-2">
            <p
              className={cn(
                "line-clamp-2 min-w-0 max-w-[calc(100vw_-_2.5rem)] flex-none translate-y-[1px] text-left text-xl font-bold leading-none",
                questionPromptIsBonus
                  ? "text-amber-400"
                  : questionPromptAccent
                    ? "text-action-learned"
                    : "text-foreground",
                canUseSuperWater(locale) && "font-super-water",
              )}
              data-quiz-mobile-prompt
            >
              {formatSuperWaterText(locale, questionPrompt)}
            </p>
            {questionPromptAccent ? (
              <span className="flex size-7 shrink-0 items-center justify-center">
                <Image
                  src="/card-status/ogrenildi_img.png"
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                  aria-hidden="true"
                />
              </span>
            ) : null}
            {questionPromptIsBonus ? (
              <span className="flex size-7 shrink-0 items-center justify-center">
                <ScoreIcon size={26} className="size-[26px]" />
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

    </>
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
    <div className="flex flex-col items-center gap-2" data-quiz-counter>
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
  const { locale } = useLocale();
  const t = useT();

  return (
    <div
      className={cn(
        "quiz-action-depth quiz-action-depth--reroll w-full min-w-0 flex-1",
        (action.disabled || hidden) && "quiz-action-depth--locked",
        className,
      )}
      data-quiz-action-hidden={hidden}
    >
      <button
        type="button"
        onClick={action.onReroll}
        disabled={action.disabled || hidden}
        className="quiz-action-scale inline-flex h-9 min-h-9 w-full items-center justify-center gap-2 rounded-md bg-[#22c987] px-3 py-1.5 text-sm font-bold text-white transition-[transform,filter] duration-200 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-100 sm:text-base"
        aria-label={t("quiz.rerollQuestion")}
        data-quiz-action-hidden={hidden}
        data-quiz-reroll
      >
        {action.loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
        <span className="min-w-0">{t("quiz.rerollQuestion")}</span>
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <span className={cn(canUseSuperWater(locale) && "font-super-water")}>
            {GEM_COSTS.rerollQuestion.amount}
          </span>
          <Image src={GEM_ASSETS.green} alt="" width={22} height={22} className="size-[22px] object-contain" />
        </span>
      </button>
    </div>
  );
}

function QuizQuestionActionRow({
  onSkip,
  skipDisabled,
  rerollAction,
  className,
}: {
  onSkip: () => void;
  skipDisabled: boolean;
  rerollAction?: QuizRerollAction;
  className?: string;
}) {
  return (
    <QuizMobileActionPortal withinTransition>
      <div
        className={cn("mt-1 flex w-full gap-2 sm:mt-2", className)}
        data-quiz-question-actions
        data-quiz-bottom-actions
        data-quiz-reroll-action
      >
        <QuizSkipButton
          className="min-w-0 flex-1"
          disabled={skipDisabled}
          onClick={onSkip}
        />
        {rerollAction ? <QuizRerollButton action={rerollAction} /> : null}
      </div>
    </QuizMobileActionPortal>
  );
}

export function GroupQuestion({
  item,
  showingAnswer,
  selectedAnswer,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: GroupQuizItem;
  showingAnswer: boolean;
  selectedAnswer?: string | null;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { question } = item;
  const nativeTerm = getCardTranslation(item.card, locale);

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
      data-quiz-question-content="group"
    >
      <p className="text-center text-sm font-semibold text-white max-lg:hidden">
        {formatSuperWaterText(locale, t("quiz.groupMeaningPrompt"))}
      </p>

      <div className="relative -translate-y-[10px] mx-auto flex w-full max-w-xl items-center justify-center border-b border-[#AAAAAA] px-1 pb-2 sm:-translate-y-[14px]">
        <div className="flex items-center justify-center gap-2">
          <h2 className="font-display text-3xl font-semibold leading-none text-white sm:text-4xl lg:text-5xl">
            {formatSuperWaterText(locale, nativeTerm)}
          </h2>
          <button
            type="button"
            onClick={() => speakCardTerm(nativeTerm, locale)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-sm:size-8"
            aria-label={`${nativeTerm} ${t("cards.speak")}`}
            title={t("cards.speak")}
          >
            <Volume2 className="size-5 max-sm:size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative top-[52px] grid grid-cols-2 gap-2 sm:gap-3">
        {question.options.map((option) => {
          // The prompt is shown in the user's native/UI language; each choice
          // is the target-language word represented by that group image.
          const optionAnswer = option.card.term;
          const isCorrectOption = option.isCorrect;
          const isSelectedOption = showingAnswer && selectedAnswer === optionAnswer;
          const feedback = showingAnswer
            ? isCorrectOption
              ? "correct"
              : isSelectedOption
                ? "incorrect"
                : "incorrect-revealed"
            : undefined;
          return (
            <QuizWordButton
              key={`${option.card.id}-${feedback ?? "idle"}`}
              type="button"
              data-quiz-group-option={option.card.id}
              onPressStart={() => playSoundEffect(isCorrectOption ? "correct" : "incorrect")}
              onClick={() => onAnswer(optionAnswer, isCorrectOption)}
              disabled={showingAnswer}
              wordType={showingAnswer ? "inactive" : isCorrectOption ? "correct" : "incorrect"}
              feedback={feedback}
              className="min-h-[6.75rem] items-center flex-col gap-1.5 px-2 py-2 text-center text-sm font-semibold leading-tight disabled:cursor-default sm:min-h-[7.5rem] sm:text-base"
            >
              <Image
                src={CARD_GROUP_IMAGE_PATHS[option.group.id]}
                alt=""
                width={72}
                height={72}
                className="mx-auto block size-14 shrink-0 object-contain sm:size-16"
                aria-hidden="true"
              />
              <span className="line-clamp-2">{formatSuperWaterText(locale, optionAnswer)}</span>
            </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
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

export function ListeningQuestion({
  item,
  showingAnswer,
  selectedAnswer,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
}: {
  item: ListeningQuizItem;
  showingAnswer: boolean;
  selectedAnswer?: string | null;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const t = useT();
  const [character] = useState(() => getRandomQuizCharacter());
  const { pronunciation } = useCardPronunciation(item.card);
  const voiceProfile = getCharacterVoiceProfile(character);
  useSpeakQuizTermAfterEntry(item.card, voiceProfile);

  return (
    <div
      className="animate-screen-pop relative top-2 flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 sm:top-3 lg:gap-4 lg:p-8"
      data-quiz-question-content="listening"
    >
      <QuizSpeechBubble
        character={character}
        term={pronunciation || "..."}
        spokenTerm={item.card.term}
        language={item.card.language}
        speakerPosition="left"
        speakerLayout="stacked"
        termClassName="!text-lg sm:!text-xl"
        speakerClassName="!size-14 !rounded-full !bg-orange-500 max-sm:!size-12"
        speakerIconClassName="!size-7 max-sm:!size-6"
        largeCharacter
      />

      <div className="relative top-[30px] flex flex-col gap-2 sm:gap-3">
        {item.question.options.map((option) => {
          const isCorrectOption = option === item.question.correctAnswer;
          const isSelectedOption = showingAnswer && selectedAnswer === option;
          const feedback = showingAnswer
            ? isCorrectOption
              ? "correct"
              : isSelectedOption
                ? "incorrect"
                : "incorrect-revealed"
            : undefined;

          return (
            <QuizWordButton
              key={`${option}-${feedback ?? "idle"}`}
              type="button"
              data-quiz-listening-option={option}
              onPressStart={() => playSoundEffect(isCorrectOption ? "correct" : "incorrect")}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              wordType={showingAnswer ? "inactive" : isCorrectOption ? "correct" : "incorrect"}
              feedback={feedback}
              className="min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-base font-semibold disabled:cursor-default sm:min-h-[5.25rem]"
            >
              {option}
            </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
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

export function ChoiceQuestion({
  item,
  showingAnswer,
  selectedAnswer,
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
  selectedAnswer?: string | null;
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
  const [character] = useState(() => getRandomQuizCharacter());
  useSpeakQuizTermAfterEntry(item.card, getCharacterVoiceProfile(character));

  return (
    <div
      className="animate-screen-pop flex w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
      data-quiz-question-content="choice"
    >
      {showPrompt ? (
        <p
          className={cn(
            "text-center text-sm font-semibold text-white",
            promptClassName,
          )}
        >
          {t("quiz.recallPrompt")}
        </p>
      ) : null}
      <QuizSpeechBubble
        character={character}
        term={item.card.term}
        language={item.card.language}
        largeCharacter
      />

      <div className="relative top-[60px] grid grid-cols-2 gap-2 sm:gap-3">
        {question.options.map((option) => {
          const isCorrectOption = option === question.correctAnswer;
          const isSelectedOption = showingAnswer && selectedAnswer === option;
          const feedback = showingAnswer
            ? isCorrectOption
              ? "correct"
              : isSelectedOption
                ? "incorrect"
                : "incorrect-revealed"
            : undefined;

          return (
            <QuizWordButton
              key={`${option}-${feedback ?? "idle"}`}
              type="button"
              data-quiz-option={option}
              onPressStart={() => playSoundEffect(isCorrectOption ? "correct" : "incorrect")}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              wordType={showingAnswer ? "inactive" : isCorrectOption ? "correct" : "incorrect"}
              feedback={feedback}
              className={cn(
                "min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-base font-semibold disabled:cursor-default sm:min-h-[5.25rem] lg:min-h-20 lg:py-3 lg:text-base",
              )}
            >
              {option}
            </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
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

export function DefinitionQuestion({
  item,
  showingAnswer,
  selectedAnswer,
  onAnswer,
  onSkip,
  rerollAction,
  onNext,
  showNextButton = true,
  isFirstQuestion = false,
}: {
  item: DefinitionQuizItem;
  showingAnswer: boolean;
  selectedAnswer?: string | null;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  rerollAction?: QuizRerollAction;
  onNext: () => void;
  showNextButton?: boolean;
  isFirstQuestion?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question;
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      speakCardTerm(item.card.term, item.card.language);
    }, QUIZ_QUESTION_ENTRY_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [item.card.id, item.card.language, item.card.term]);

  return (
      <div
        className="animate-screen-pop flex w-full flex-col items-center gap-3 rounded-lg border border-transparent bg-transparent p-0 lg:gap-4 lg:p-8"
        data-quiz-question-content="definition"
      >
      <div className="relative top-[20px] flex flex-col items-center gap-2">
        <p className={cn(
          "text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl",
          canUseSuperWater(locale) && "font-super-water",
        )}>
          {formatSuperWaterText(locale, t("quiz.definitionPrompt"))}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => speakCardTerm(item.card.term, item.card.language)}
            className="inline-flex size-10 items-center justify-center rounded-md text-white transition-colors hover:bg-background-muted hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-sm:size-8"
            aria-label={`${item.card.term} ${t("cards.speak")}`}
            title={t("cards.speak")}
          >
            <Volume2 className="size-5 max-sm:size-4" aria-hidden="true" />
          </button>
          <h2 className="font-display text-3xl font-semibold leading-none text-white sm:text-4xl lg:text-6xl">
            {item.card.term}
          </h2>
        </div>
      </div>

      <div className="relative top-[60px] grid w-full grid-cols-1 gap-2 sm:gap-3">
        {question.options.map((option) => {
          const isCorrectOption = option === question.correctAnswer;
          const isSelectedOption = showingAnswer && selectedAnswer === option;
          const feedback = showingAnswer
            ? isCorrectOption
              ? "correct"
              : isSelectedOption
                ? "incorrect"
                : "incorrect-revealed"
            : undefined;

          return (
            <QuizWordButton
              key={`${option}-${feedback ?? "idle"}`}
              type="button"
              data-quiz-definition-option={option}
              onPressStart={() => playSoundEffect(isCorrectOption ? "correct" : "incorrect")}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              wordType={showingAnswer ? "inactive" : isCorrectOption ? "correct" : "incorrect"}
              feedback={feedback}
              className="min-h-[4.5rem] items-center justify-center px-3 py-2 text-center text-sm font-semibold disabled:cursor-default sm:min-h-[5.25rem] sm:text-base"
            >
              {option}
            </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
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

export function SentenceCompletionQuestion({
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
      <p className="text-center text-sm font-semibold text-white max-lg:hidden">
        {t("quiz.sentenceCompletionPrompt")}
      </p>

      <div className="flex w-full items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="relative -mb-1 h-36 w-36 sm:-mb-2 sm:h-40 sm:w-40">
            <Image
              src={character.imageSrc}
              alt={characterName}
              fill
              sizes="(max-width: 639px) 144px, 160px"
              quality={90}
              className="object-contain object-bottom"
            />
          </div>
          <div className="relative min-h-20 rounded-2xl border-[3px] border-[#AAAAAA] bg-background-card px-4 py-3 text-left before:absolute before:left-12 before:-top-2 before:size-3 before:rotate-45 before:border-l-[3px] before:border-t-[3px] before:border-[#AAAAAA] before:bg-background-card">
            <p
              className="relative text-lg font-semibold leading-relaxed text-white sm:text-xl"
              data-quiz-sentence
            >
              {question.sentenceWithBlank}
            </p>
          </div>
        </div>
        {mobileCard ? <div className="flex shrink-0 items-end justify-center lg:hidden">{mobileCard}</div> : null}
      </div>

      <div className="relative top-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {question.options.map((option) => {
          const isCorrectOption = option === question.correctAnswer;
          const isSelectedOption = option === selectedAnswer;
          const isValidatingOption = isAiValidating && option === aiValidatingAnswer;
          const feedback = !showingAnswer
            ? isSelectedOption
              ? "selected"
              : "idle"
            : isSelectedOption
              ? answerAccepted
                ? "correct"
                : "incorrect"
              : !answerAccepted && isCorrectOption
                ? "correct"
                : "muted";

          return (
            <QuizWordButton
              key={`${option}-${feedback}`}
              type="button"
              data-quiz-sentence-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer || isAiValidating}
              wordType={showingAnswer ? "inactive" : isCorrectOption ? "correct" : "incorrect"}
              feedback={feedback}
              className={cn(
                "min-h-[5.25rem] items-center justify-center px-2 py-2 text-center text-sm font-semibold sm:min-h-24 sm:px-3 sm:text-base",
              )}
            >
              {isValidatingOption ? (
                <Loader2
                  className="mx-auto size-5 animate-spin"
                  data-quiz-sentence-option-loading
                  aria-label={t("quiz.aiValidating")}
                />
              ) : (
                option
              )}
            </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer || isAiValidating}
        rerollAction={rerollAction}
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

export function TrueFalseQuestion({
  item,
  showingAnswer,
  selectedAnswer,
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
  selectedAnswer?: string | null;
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
  const [character] = useState(() => getRandomQuizCharacter());
  useSpeakQuizTermAfterEntry(item.card, getCharacterVoiceProfile(character));
  const options = [
    {
      value: "true" as const,
      label: t("games.wordChallenge.correct"),
      isCorrect: question.correctAnswer === "true",
    },
    {
      value: "false" as const,
      label: t("games.wordChallenge.wrong"),
      isCorrect: question.correctAnswer === "false",
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
            "text-center text-sm font-semibold text-white",
            promptClassName,
          )}
        >
          {t("games.wordChallenge.title")}
        </p>
      ) : null}

      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <p className="text-sm font-semibold text-foreground-muted max-lg:hidden">
          {t("games.wordChallenge.question")}
        </p>
        <div data-quiz-true-false-meaning className="w-full">
          <QuizSpeechBubble
            character={character}
            term={item.card.term}
            language={item.card.language}
            secondaryText={`= ${question.proposedMeaning}`}
            showSpeaker={false}
            largeCharacter
            characterClassName="!h-44 !w-44 sm:!h-48 sm:!w-48"
            bubbleClassName="relative -left-4 sm:-left-6"
            className="relative top-7"
          />
        </div>
      </div>

      <div className="relative top-10 mt-7 grid w-full max-w-md grid-cols-2 gap-3 sm:gap-4">
        {options.map((option) => {
          const isSelectedOption = showingAnswer && selectedAnswer === option.value;
          const feedback = showingAnswer
            ? option.isCorrect
              ? "correct"
              : isSelectedOption
                ? "incorrect"
                : "incorrect-revealed"
            : undefined;

          return (
          <QuizWordButton
            key={`${option.value}-${feedback ?? "idle"}`}
            type="button"
            data-quiz-true-false-option={option.value}
            onPressStart={() => playSoundEffect(option.isCorrect ? "correct" : "incorrect")}
            onClick={() => onAnswer(option.value, option.isCorrect)}
            disabled={showingAnswer}
            wordType={showingAnswer ? "inactive" : option.isCorrect ? "correct" : "incorrect"}
            feedback={feedback}
            className={cn(
              "aspect-square min-h-0 items-center justify-center px-3 py-4 text-2xl font-semibold sm:text-3xl lg:text-4xl",
            )}
          >
            {option.label}
          </QuizWordButton>
          );
        })}
      </div>

      <QuizQuestionActionRow
        skipDisabled={showingAnswer}
        rerollAction={rerollAction}
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

export function TextQuestion({
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
  mascotAnimation,
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
  mascotAnimation?: QuizFeedbackMascotAnimation | null;
  showNextButton?: boolean;
  isFirstQuestion?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question;
  const [character] = useState(() => getRandomQuizCharacter());
  const [fallbackMascotAnimation] = useState(() =>
    pickQuizFeedbackMascotAnimation(
      false,
      0,
      [0.2, 0.6, 0.99][Math.floor(Math.random() * 3)]!,
    ),
  );
  const activeMascotAnimation = mascotAnimation ?? fallbackMascotAnimation;
  const [mascotReady, setMascotReady] = useState(!activeMascotAnimation);
  const checkDisabled = textAnswer.trim().length === 0 || isAiValidating || showingAnswer;
  const cardLanguageName = getLanguageDisplayName(item.card.language, locale);
  useEffect(() => {
    setMascotReady(!activeMascotAnimation);
    if (activeMascotAnimation) preloadQuizFeedbackMascotAnimation(activeMascotAnimation);
  }, [activeMascotAnimation]);
  const handleMascotReady = useCallback(() => setMascotReady(true), []);
  const handleMascotError = useCallback(() => setMascotReady(false), []);
  async function handleSubmit() {
    if (showingAnswer || isAiValidating) return;
    await onSubmitText(textAnswer);
  }

  return (
      <div
        className="animate-screen-pop flex min-h-full flex-1 w-full flex-col gap-3 rounded-lg border border-transparent bg-transparent p-0 max-lg:pb-24 lg:gap-4 lg:p-8"
        data-quiz-question-content="text"
        data-quiz-text-question
      >
        <div className="relative -top-20 flex flex-col items-center gap-2">
          <div className="flex items-center justify-center">
          <h2 className="font-display text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-8xl">
            {getCardTranslation(item.card, locale)}
          </h2>
          </div>
        </div>

        <div className="relative -top-16">
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
            placeholder={t("quiz.learningQuizPlaceholder", { language: cardLanguageName })}
            className={cn(
              "h-14 min-h-14 w-full rounded-2xl border-[3px] border-[#AAAAAA] bg-background px-4 text-sm font-semibold text-foreground outline-none placeholder:text-foreground-muted focus:border-[#AAAAAA]",
            )}
          />

          <div
            className="mt-6 flex w-full flex-col gap-2"
            data-quiz-question-actions
            data-quiz-reroll-action
          >
            <div
              className={cn(
                "quiz-action-depth quiz-action-depth--check w-full",
                checkDisabled && "quiz-action-depth--locked",
              )}
            >
              <Button
                className="quiz-action-scale w-full disabled:opacity-100"
                onClick={handleSubmit}
                disabled={checkDisabled}
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
            </div>
          </div>

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
        </div>

        <QuizMobileActionPortal withinTransition mobileOnly>
          <div className="mt-auto w-full" data-quiz-text-speech>
            <QuizSpeechBubble
              character={character}
              term={t("quiz.learningQuizPrompt", { language: cardLanguageName })}
              language={item.card.language}
              showSpeaker={false}
              showCharacter={false}
              arrowPosition="bottom"
              className={cn(
                "text-question-speech-row !items-stretch !mt-0 !max-w-md !flex-col relative -top-[20px] border-b-0 !px-0 transition-opacity duration-150",
                mascotReady ? "opacity-100" : "pointer-events-none opacity-0",
                mascotAnimation?.id === "animation-5"
                  ? "!translate-y-[15px]"
                  : "!translate-y-0",
              )}
              bubbleClassName="text-question-speech-bubble-enter w-full px-3 py-2 sm:px-4 sm:py-3"
            />
            <div className={cn(
              "relative -top-[35px] flex h-44 w-full items-end justify-center overflow-visible",
              mascotAnimation?.id === "animation-2" && "scale-[0.9]",
            )}>
              <QuizFeedbackMascotAnimationView
                animation={activeMascotAnimation!}
                onReady={handleMascotReady}
                onError={handleMascotError}
              />
            </div>
            <div className="relative -top-[35px] h-px w-full bg-[#AAAAAA]" aria-hidden="true" />
          </div>
        </QuizMobileActionPortal>

          <div
            className="mt-2 flex w-full flex-col gap-2"
            data-quiz-question-actions
            data-quiz-reroll-action
          >
            <QuizMobileActionPortal withinTransition>
              <div
                className="flex w-full gap-2"
                data-quiz-bottom-actions
              >
                <QuizSkipButton
                  className="min-w-0 flex-[0.8]"
                  disabled={isAiValidating || showingAnswer}
                  onClick={onSkip}
                />
                {rerollAction ? (
                  <QuizRerollButton
                    action={rerollAction}
                    className="flex-[1.2]"
                  />
                ) : null}
              </div>
            </QuizMobileActionPortal>
          </div>
      </div>
  );
}

export function MobileQuizFeedback({
  isOpen,
  isCorrect,
  isBonus = false,
  isText = false,
  forceMascotAnimation = false,
  correctAnswer,
  onNext,
  showNextButton = true,
}: {
  isOpen: boolean;
  isCorrect: boolean;
  isBonus?: boolean;
  isText?: boolean;
  forceMascotAnimation?: boolean;
  correctAnswer?: string;
  onNext: () => void;
  showNextButton?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [snapshot, setSnapshot] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
  } | null>(null);
  const [mascotAnimation, setMascotAnimation] = useState<QuizFeedbackMascotAnimation | null>(null);
  const [mascotVisible, setMascotVisible] = useState(false);
  const mascotAnimationRef = useRef<QuizFeedbackMascotAnimation | null>(null);

  useEffect(() => {
    if (isOpen) {
      const selectedAnimation = pickQuizFeedbackBarMascotAnimation(
        isBonus,
        isText,
        forceMascotAnimation ? 0 : undefined,
      );
      mascotAnimationRef.current = selectedAnimation;
      setMascotAnimation(selectedAnimation);
      setMascotVisible(Boolean(selectedAnimation));

      if (!selectedAnimation) return;

      preloadQuizFeedbackMascotAnimation(selectedAnimation);
      return;
    }

    if (!mascotAnimationRef.current) return;

    const exitTimer = window.setTimeout(() => {
      mascotAnimationRef.current = null;
      setMascotVisible(false);
      setMascotAnimation(null);
    }, 300);

    return () => window.clearTimeout(exitTimer);
  }, [forceMascotAnimation, isBonus, isOpen, isText]);

  useEffect(() => {
    if (isOpen) {
      setSnapshot({ isCorrect, correctAnswer: correctAnswer ?? "" });
    }
  }, [isOpen, isCorrect, correctAnswer]);

  const display = snapshot ?? { isCorrect, correctAnswer: correctAnswer ?? "" };
  const feedbackText = display.isCorrect
    ? t("quiz.congratulations")
    : t("quiz.wrongAnswer");
  const correctAnswerLabel = t("quiz.correctAnswerWithValue", { answer: "" }).trim();
  const feedbackButtonDisabled = isCorrect && !showNextButton;
  const feedbackButtonVisible = isOpen && !feedbackButtonDisabled;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex flex-col justify-end transition-opacity duration-300 max-lg:flex lg:hidden",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      data-quiz-mobile-feedback
    >
      <div
        className={cn(
          "relative flex w-full items-center justify-between gap-4 rounded-t-2xl p-5 shadow-lg transition-transform duration-300",
          display.isCorrect ? "min-h-24" : "min-h-32",
          display.isCorrect ? "bg-emerald-500" : "bg-rose-500",
          isOpen ? "translate-y-0" : "translate-y-full",
          canUseSuperWater(locale) && "font-super-water",
        )}
      >
        {mascotAnimation && mascotVisible ? (
          <div className="pointer-events-none absolute bottom-full left-2 z-0">
            <QuizFeedbackMascotAnimationView animation={mascotAnimation} />
          </div>
        ) : null}
        <div
          className={cn(
            "relative z-10 flex min-w-0 gap-3",
            display.isCorrect || !display.correctAnswer ? "items-center" : "items-start",
          )}
        >
          <QuizFeedbackStatusIcon isCorrect={display.isCorrect} />
          <div className="min-w-0">
            <p className={cn(
              "font-bold text-white",
              display.isCorrect ? "text-base" : "text-xl",
            )}>
              {formatSuperWaterText(locale, feedbackText)}
            </p>
            {!display.isCorrect && display.correctAnswer ? (
              <div className="mt-2 flex flex-col text-base leading-tight text-white/95">
                <span className="font-semibold">
                  {formatSuperWaterText(locale, correctAnswerLabel)}
                </span>
                <span className="mt-0 break-words text-2xl font-bold leading-tight sm:text-3xl">
                  {` ${formatSuperWaterText(locale, display.correctAnswer)}`}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <Button
          className={cn(
            "relative z-10 shrink-0 touch-manipulation rounded-full bg-white px-5 text-base font-bold transition-none hover:bg-white/90",
            display.isCorrect ? "text-emerald-600" : "text-rose-600",
            !feedbackButtonVisible && "invisible pointer-events-none",
          )}
          onClick={onNext}
          data-quiz-mobile-feedback-next
          disabled={feedbackButtonDisabled}
        >
          {formatSuperWaterText(locale, t("quiz.feedbackContinue"))}
        </Button>
      </div>
    </div>
  );
}

function QuizFeedbackStatusIcon({ isCorrect }: { isCorrect: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white",
        isCorrect ? "text-emerald-600" : "text-rose-600",
      )}
      data-quiz-feedback-status-icon
      aria-hidden="true"
    >
      {isCorrect ? (
        <Check className="size-6 stroke-[3.5]" />
      ) : (
        <X className="size-6 stroke-[3.5]" />
      )}
    </span>
  );
}

const LEARNED_REWARD_SETTLE_DELAY_MS = 500;
const LEARNED_CARD_ROTATION_DURATION_MS = 1000;
const LEARNED_REWARD_FAILSAFE_CLOSE_MS = 2600;

export function CelebrationView({
  card,
  basePoints,
  enterWithCss = false,
  onContinue,
}: {
  card: VocabularyCard;
  basePoints: number;
  enterWithCss?: boolean;
  onContinue: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { refreshStats } = useProgressStats();
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [rewardStarted, setRewardStarted] = useState(false);
  const onContinueRef = useRef(onContinue);
  const closeTimerRef = useRef<number | null>(null);
  const closeScheduledRef = useRef(false);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const gainedPoints = getPointsForTier(card.tier);

  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const idleVibrationTimer = window.setTimeout(() => vibrate("tap"), 720);
    return () => window.clearTimeout(idleVibrationTimer);
  }, []);

  function handleStartReward() {
    if (rewardStarted) return;

    setRewardStarted(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (closeScheduledRef.current) return;
      closeScheduledRef.current = true;
      void refreshStats();
      onContinueRef.current();
    }, LEARNED_REWARD_FAILSAFE_CLOSE_MS);
    vibrate("learned");
    playSoundEffect("confetti");
    vibrate("confetti");
    void confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#ffffff", TIER_CONFETTI_COLORS[card.tier]],
      disableForReducedMotion: true,
    });
  }

  return (
    <div
      className={cn(
        enterWithCss && "quiz-flow-enter-right",
        "absolute inset-0 z-40 overflow-hidden bg-background px-4 py-6 text-center sm:px-6 sm:py-8",
        rewardStarted && "animate-quiz-tier-background-flash",
      )}
      style={{ "--quiz-tier-flash-color": TIER_RAY_COLOR_VARIABLES[card.tier] } as CSSProperties}
      data-quiz-celebration
      data-quiz-celebration-stage="score-flight"
      role="button"
      tabIndex={0}
      aria-label={t("quiz.tapToContinue")}
      onClick={handleStartReward}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleStartReward();
        }
      }}
    >
      <div className="relative h-full w-full">
        <div className="relative z-10 h-full w-full">
        <div
          className={cn(
            "quiz-learned-reward-hud absolute inset-x-0 top-3 z-10 flex flex-col items-center justify-center gap-1 sm:top-4",
            rewardStarted && "quiz-learned-reward-hud--visible",
          )}
          data-quiz-celebration-score-group
        >
            <MainPointsDisplay
              targetRef={scoreRef}
              pulse={scorePulse}
              data-quiz-celebration-score
              valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
              value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
            />
            <RewardGemHud animate superWater={canUseSuperWater(locale)} />
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
          <div
            ref={cardRef}
            className={cn(
              "relative w-[min(260px,68vw)] max-w-full sm:w-[min(292px,76vw)]",
              !rewardStarted && "animate-quiz-card-idle-attention",
              rewardStarted && "animate-quiz-learned-card-reward",
            )}
            style={
              rewardStarted
                ? { animationDuration: `${LEARNED_CARD_ROTATION_DURATION_MS}ms` }
                : undefined
            }
            data-quiz-celebration-card
          >
            <QuizTierRayField tier={card.tier} fading={rewardStarted} />
            <VocabularyCardView
              card={card}
              owned
              initialFace="front"
              face="front"
              flippable={false}
              continuousFlip={rewardStarted}
              className="relative z-10 h-auto w-full min-h-0 max-sm:aspect-[3/4] max-sm:min-h-0"
            />
          </div>
        </div>
        </div>
      </div>
      {rewardStarted ? (
        <RewardScatter
          points={{ amount: gainedPoints, source: cardRef, target: scoreRef, zIndex: 50 }}
          onPointsArrive={(awardedTotal, arrivalIndex) => {
            setDisplayPoints(basePoints + awardedTotal);
            setScorePulse(arrivalIndex);
          }}
          onPointsComplete={() => {
            if (closeScheduledRef.current) return;
            closeScheduledRef.current = true;
            void refreshStats();
            if (closeTimerRef.current !== null) {
              window.clearTimeout(closeTimerRef.current);
            }
            closeTimerRef.current = window.setTimeout(() => {
              closeTimerRef.current = null;
              onContinueRef.current();
            }, LEARNED_REWARD_SETTLE_DELAY_MS);
          }}
        />
      ) : null}
    </div>
  );
}

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

type ResultFlowViewProps = {
  mode: PracticeMode;
  results: QuizResult;
  selectedCount: number | null;
  quizSessionId?: string | null;
  quizDurationSeconds?: number;
  chestOpened: boolean;
  streakRewardStreak?: number;
  streakRewardPoints?: number;
  locked?: boolean;
  showResultMessage?: boolean;
  showChestRewardGate?: boolean;
  chestTier?: ChestTierDefinition | null;
  chestTotalPoints?: number;
  onChestRewardReady?: () => Promise<ChestRewardOutcome | null>;
  learnedCards?: readonly VocabularyCard[];
  advancedCards?: readonly VocabularyCard[];
  advancedCardProgress?: Readonly<Record<string, number>>;
  remainingActiveCards?: number;
  nearLearnedCards?: number;
  nearLevelUpCards?: number;
  rankProgressPercent?: number;
  pointsToNextRank?: number;
  currentRankIcon?: RankIconId;
  nextRankIcon?: RankIconId | null;
  gainedGems?: number;
  onResultMessageComplete?: () => void;
  onContinue?: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export function ResultFlowView({
  showResultMessage = false,
  showChestRewardGate = false,
  chestTier = null,
  chestTotalPoints = 0,
  onChestRewardReady,
  learnedCards = [],
  advancedCards = [],
  advancedCardProgress,
  remainingActiveCards = 0,
  nearLearnedCards = 0,
  nearLevelUpCards = 0,
  rankProgressPercent = 0,
  pointsToNextRank = 0,
  currentRankIcon = "trophy",
  nextRankIcon = "medal",
  gainedGems = 0,
  onResultMessageComplete,
  ...resultProps
}: ResultFlowViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const { data: leaderboardData } = useLeaderboardData({
    enabled: resultProps.mode !== "learned",
    refreshOnMount: true,
  });
  const [messageStageVisible] = useState(showResultMessage);
  const [resultStageVisible, setResultStageVisible] = useState(!showResultMessage);
  const [chestGateVisible, setChestGateVisible] = useState(false);
  const [continuationMotivationVisible, setContinuationMotivationVisible] = useState(false);
  const [chestRewardGemCount, setChestRewardGemCount] = useState(gainedGems);
  const resultPerformance = getQuizPerformanceSummary(
    resultProps.mode,
    resultProps.results,
    resultProps.selectedCount,
    resultProps.chestOpened,
  );
  const missedChestRequiredAccuracy = formatNumber(locale, 70);
  const missedChestReason = resultProps.mode === "active"
    ? t("chest.missedReason", { required: missedChestRequiredAccuracy })
    : t("chest.missedMode");
  const missedChestProgress = t("chest.missedProgress", {
    accuracy: formatNumber(locale, resultPerformance.accuracy),
  });
  const chestWasMissed =
    showChestRewardGate && resultProps.mode === "active" && chestTier === null;
  const medalRating =
    resultPerformance.accuracy >= 90
      ? 5
      : resultPerformance.accuracy >= 75
        ? 4
        : resultPerformance.accuracy >= 60
          ? 3
          : resultPerformance.accuracy >= 40
            ? 2
            : 1;
  const continuationInput: QuizContinuationMotivationInput = {
    nearLearnedCount: nearLearnedCards,
    nearLevelUpCount: nearLevelUpCards,
    rankProgressPercent,
    pointsToNextRank,
    accuracy: resultPerformance.accuracy,
    incorrectCount: resultProps.results.incorrect.length,
    answeredCount:
      resultProps.results.correct.length +
      resultProps.results.incorrect.length +
      (resultProps.results.bonusCorrect ?? 0) +
      (resultProps.results.bonusIncorrect ?? 0),
    remainingActiveCards,
    gainedXp: getQuizResultRewardPoints(medalRating, resultProps.selectedCount ?? 10) ?? 0,
    gainedGems: chestRewardGemCount,
    earnedMedals: medalRating,
    chestWasMissed,
    chestMissedByPercentagePoints: Math.max(0, 70 - resultPerformance.accuracy),
  };

  const handleResultContinue = () => {
    if (showChestRewardGate && !chestGateVisible) {
      setChestGateVisible(true);
      return;
    }

    resultProps.onContinue?.();
  };

  const handleChestRewardReady = useCallback(async () => {
    const outcome = await onChestRewardReady?.();
    if (outcome) {
      setChestRewardGemCount(
        outcome.rewards.reduce((total, reward) => total + reward.amount, 0),
      );
    }
    return outcome ?? null;
  }, [onChestRewardReady, setChestRewardGemCount]);

  const handleChestGateComplete = () => {
    setChestGateVisible(false);
    setContinuationMotivationVisible(true);
  };

  const handleContinuationContinue = () => {
    setContinuationMotivationVisible(false);
    resultProps.onContinue?.();
  };

  const handleContinuationExit = () => {
    setContinuationMotivationVisible(false);
    resultProps.onExit();
  };

  if (resultProps.mode === "learned") {
    return (
      <div
        className="relative h-full w-full overflow-hidden"
        data-quiz-result-flow
        data-quiz-review-result-only
      >
        <QuizContinuationMotivationView
          input={continuationInput}
          hasMoreCardsToLearn={remainingActiveCards > 0}
          isReviewQuiz
          currentRankIcon={currentRankIcon}
          nextRankIcon={nextRankIcon}
          leaderboardData={leaderboardData}
          onContinue={handleContinuationContinue}
          onExit={handleContinuationExit}
        />
      </div>
    );
  }

  if (messageStageVisible) {
    return (
      <div className="relative h-full w-full overflow-hidden" data-quiz-result-flow>
        <ChestCelebrationView
          learnedCards={learnedCards}
          advancedCards={advancedCards}
          advancedCardProgress={advancedCardProgress}
          preserveMessageOnComplete
          onComplete={() => {
            setResultStageVisible(true);
            onResultMessageComplete?.();
          }}
        />
        {resultStageVisible ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-[var(--background)]"
            data-quiz-result-main-layer
          >
            <ResultView
              {...resultProps}
              onContinue={handleResultContinue}
              showMedalHud={!chestGateVisible && !continuationMotivationVisible}
            />
          </div>
        ) : null}
        {resultStageVisible && chestGateVisible ? (
          <div className="absolute inset-0 z-40 overflow-hidden bg-[var(--background)]" data-quiz-chest-reward-layer>
            <QuizChestRewardGate
              tier={chestTier}
              totalPoints={chestTotalPoints}
              accuracy={resultPerformance.accuracy}
              missedReason={missedChestReason}
              missedProgress={missedChestProgress}
              onComplete={handleChestGateComplete}
              onRewardReady={onChestRewardReady ? handleChestRewardReady : undefined}
            />
          </div>
        ) : null}
        {resultStageVisible && continuationMotivationVisible ? (
          <QuizContinuationMotivationView
            input={continuationInput}
            hasMoreCardsToLearn={remainingActiveCards > 0}
            currentRankIcon={currentRankIcon}
            nextRankIcon={nextRankIcon}
            leaderboardData={leaderboardData}
            onContinue={handleContinuationContinue}
            onExit={handleContinuationExit}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden" data-quiz-result-flow>
      <ResultView
        {...resultProps}
        onContinue={handleResultContinue}
        showMedalHud={!chestGateVisible && !continuationMotivationVisible}
      />
      {chestGateVisible ? (
        <div className="absolute inset-0 z-40 overflow-hidden bg-[var(--background)]" data-quiz-chest-reward-layer>
          <QuizChestRewardGate
            tier={chestTier}
            totalPoints={chestTotalPoints}
            accuracy={resultPerformance.accuracy}
            missedReason={missedChestReason}
            missedProgress={missedChestProgress}
            onComplete={handleChestGateComplete}
            onRewardReady={onChestRewardReady ? handleChestRewardReady : undefined}
          />
        </div>
      ) : null}
      {continuationMotivationVisible ? (
        <QuizContinuationMotivationView
          input={continuationInput}
          hasMoreCardsToLearn={remainingActiveCards > 0}
          leaderboardData={leaderboardData}
          onContinue={handleContinuationContinue}
          onExit={handleContinuationExit}
        />
      ) : null}
    </div>
  );
}

const RESULT_MEDAL_IMAGE_SRC = "/quiz/result-cards/star.png?v=20261003-2";
const RESULT_MEDAL_CENTER_ICON_SIZE = 58;
const RESULT_MEDAL_COLLECT_PLAYBACK_RATE_STEP = 0.2;
const RESULT_MEDAL_COLLECT_MAX_PLAYBACK_RATE = 2.5;
const RESULT_MEDAL_HUD_PULSE_DURATION_MS = 350;
const RESULT_VIDEO_AUDIO_FADE_OUT_MS = 700;
const RESULT_ANIMATION_VIDEO_SOURCES = [
  "/quiz/result_animation_1.mp4?v=20261007-1",
  "/quiz/result_animation_2.mp4?v=20261007-1",
] as const;
const RESULT_ANIMATION_AUDIO_SOURCES = {
  "result_animation_1": "/quiz/result-animation-1-audio.m4a?v=20261007-1",
  "result_animation_2": "/quiz/result-animation-2-audio.m4a?v=20261007-1",
} as const;
let resultAnimationVideoIndex = 0;

function getNextResultAnimationVideoSource() {
  const source = RESULT_ANIMATION_VIDEO_SOURCES[resultAnimationVideoIndex];
  resultAnimationVideoIndex = (resultAnimationVideoIndex + 1) % RESULT_ANIMATION_VIDEO_SOURCES.length;
  return source;
}

type ResultMedalFlightRequest = {
  flightId: number;
  amount: number;
  source: RewardScatterRect;
  sources: RewardScatterRect[];
  target: RewardScatterRect;
  totalMedals: number;
};

export function ResultView({
  mode,
  results,
  selectedCount,
  quizSessionId = null,
  quizDurationSeconds = 0,
  chestOpened,
  onContinue,
  showMedalHud = true,
}: {
  mode: PracticeMode;
  results: QuizResult;
  selectedCount: number | null;
  quizSessionId?: string | null;
  quizDurationSeconds?: number;
  chestOpened: boolean;
  onContinue?: () => void;
  showMedalHud?: boolean;
  onRestart: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const requireAuthAction = useRequireAuthAction();
  const performance = getQuizPerformanceSummary(
    mode,
    results,
    selectedCount,
    chestOpened,
  );
  const medalRating = useMemo(() => {
    if (!quizSessionId) return 3;

    const accuracy = performance.accuracy;
    if (accuracy >= 90) return 5;
    if (accuracy >= 75) return 4;
    if (accuracy >= 60) return 3;
    if (accuracy >= 40) return 2;
    return 1;
  }, [performance.accuracy, quizSessionId]);
  const [displayedMedals, setDisplayedMedals] = useState(user?.profile.quizResultMedals ?? 0);
  const [medalPulse, setMedalPulse] = useState<number | null>(null);
  const [claimingMedals, setClaimingMedals] = useState(false);
  const [claimedMedals, setClaimedMedals] = useState(false);
  const [medalsFlightMounted, setMedalsFlightMounted] = useState(false);
  const [medalFlightRequests, setMedalFlightRequests] = useState<ResultMedalFlightRequest[]>([]);
  const [openMenu, setOpenMenu] = useState<
    "correct" | "incorrect" | "learned" | null
  >(null);
  const [medalCenterFlight, setMedalCenterFlight] = useState<{
    sources: RewardScatterRect[];
    center: RewardScatterRect;
    target: RewardScatterRect;
    totalMedals: number;
    remaining: number;
  } | null>(null);
  const [medalCenterTapReady, setMedalCenterTapReady] = useState(false);
  const medalSourceRef = useRef<HTMLDivElement>(null);
  const medalTargetRef = useRef<HTMLSpanElement>(null);
  const medalCollectSoundCountRef = useRef(0);
  const medalPulseSequenceRef = useRef(0);
  const medalPulseTimerRef = useRef<number | null>(null);
  const medalFlightSequenceRef = useRef(0);
  const activeMedalFlightsRef = useRef(0);
  const medalRemainingRef = useRef(0);
  const medalClaimTotalRef = useRef<number | null>(null);
  const medalClaimFailedRef = useRef(false);
  const isResultTest = !quizSessionId;
  const resultAnimationSourceInitializedRef = useRef(false);
  const resultAnimationAudioRef = useRef<HTMLAudioElement | null>(null);
  const [resultAnimationVideoSource, setResultAnimationVideoSource] = useState<
    (typeof RESULT_ANIMATION_VIDEO_SOURCES)[number]
  >(
    RESULT_ANIMATION_VIDEO_SOURCES[0],
  );

  useLayoutEffect(() => {
    if (resultAnimationSourceInitializedRef.current) return;
    resultAnimationSourceInitializedRef.current = true;
    setResultAnimationVideoSource(getNextResultAnimationVideoSource());
  }, []);

  useEffect(() => {
    return () => {
      if (medalPulseTimerRef.current !== null) {
        window.clearTimeout(medalPulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => () => {
    resultAnimationAudioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!claimingMedals && !claimedMedals) {
      setDisplayedMedals(user?.profile.quizResultMedals ?? 0);
    }
  }, [claimingMedals, claimedMedals, user?.profile.quizResultMedals]);

  const playMedalCollectSound = useCallback(() => {
    const playbackRate = Math.min(
      RESULT_MEDAL_COLLECT_MAX_PLAYBACK_RATE,
      1 + medalCollectSoundCountRef.current * RESULT_MEDAL_COLLECT_PLAYBACK_RATE_STEP,
    );
    playSoundEffect("result-medal-collect", { playbackRate });
    medalCollectSoundCountRef.current += 1;
  }, []);

  const startMedalCollection = useCallback((
    currentMedals: number,
    totalMedals: number,
    target: RewardScatterRect,
    sourceRects: RewardScatterRect[],
  ) => {
    const center: RewardScatterRect = {
      left: window.innerWidth / 2 - RESULT_MEDAL_CENTER_ICON_SIZE / 2,
      top: window.innerHeight / 2 - RESULT_MEDAL_CENTER_ICON_SIZE / 2,
      width: RESULT_MEDAL_CENTER_ICON_SIZE,
      height: RESULT_MEDAL_CENTER_ICON_SIZE,
    };

    setDisplayedMedals(currentMedals);
    setMedalsFlightMounted(false);
    setMedalCenterTapReady(false);
    setMedalPulse(null);
    medalCollectSoundCountRef.current = 0;
    medalFlightSequenceRef.current = 0;
    activeMedalFlightsRef.current = 0;
    setMedalFlightRequests([]);
    medalClaimTotalRef.current = null;
    medalClaimFailedRef.current = false;
    medalRemainingRef.current = medalRating;
    const resolvedSourceRects = Array.from(
      { length: medalRating },
      (_, index) => sourceRects[index] ?? sourceRects[0] ?? center,
    );
    setMedalCenterFlight({
      center,
      sources: resolvedSourceRects,
      target,
      totalMedals,
      remaining: medalRating,
    });
    // The center flight is allowed to animate while its full-screen hit target
    // is already active. Waiting for the entrance animation (or the claim RPC)
    // made taps during this phase feel lost on slower devices.
    setMedalCenterTapReady(true);
  }, [medalRating]);

  const collectNextMedal = useCallback(() => {
    if (!medalCenterFlight || !medalCenterTapReady) return;

    const remaining = medalRemainingRef.current;
    if (remaining <= 0) return;

    medalRemainingRef.current = remaining - 1;
    playMedalCollectSound();
    vibrate("result-medal-collect");
    setMedalCenterFlight((current) => current ? { ...current, remaining: current.remaining - 1 } : current);
    const flightRequest: ResultMedalFlightRequest = {
      flightId: ++medalFlightSequenceRef.current,
      amount: 1,
      source: medalCenterFlight.center,
      sources: [medalCenterFlight.center],
      target: medalCenterFlight.target,
      totalMedals: medalCenterFlight.totalMedals,
    };
    activeMedalFlightsRef.current += 1;
    setMedalFlightRequests((current) => [...current, flightRequest]);
  }, [medalCenterFlight, medalCenterTapReady, playMedalCollectSound]);

  const collectMedals = useCallback(() => {
    if (claimingMedals || claimedMedals) return;

    vibrate("result-medal-collect");

    const currentMedals = user?.profile.quizResultMedals ?? 0;
    const source = medalSourceRef.current?.getBoundingClientRect();
    const target = medalTargetRef.current?.getBoundingClientRect();
    const sources = medalSourceRef.current
      ? Array.from(
          medalSourceRef.current.querySelectorAll<HTMLElement>('[data-quiz-medal="filled"]'),
        ).map((element) => element.getBoundingClientRect())
      : [];
    if (isResultTest) {
      if (!source || !target) {
        onContinue?.();
        return;
      }

      setClaimingMedals(true);
      startMedalCollection(
        currentMedals,
        currentMedals + medalRating,
        target,
        (sources.length > 0 ? sources : [source]).reverse(),
      );
      return;
    }

    if (!user) {
      onContinue?.();
      return;
    }

    requireAuthAction(() => {
      setClaimingMedals(true);
      const currentProfileMedals = user.profile.quizResultMedals ?? 0;
      const currentSource = medalSourceRef.current?.getBoundingClientRect();
      const currentTarget = medalTargetRef.current?.getBoundingClientRect();
      const currentSources = medalSourceRef.current
        ? Array.from(
            medalSourceRef.current.querySelectorAll<HTMLElement>('[data-quiz-medal="filled"]'),
          ).map((element) => element.getBoundingClientRect())
        : [];
      if (!currentSource || !currentTarget) {
        setClaimingMedals(false);
        return;
      }

      startMedalCollection(
        currentProfileMedals,
        currentProfileMedals + medalRating,
        currentTarget,
        (currentSources.length > 0 ? currentSources : [currentSource]).reverse(),
      );

      void (async () => {
        const result = await claimQuizResultMedals(quizSessionId, medalRating);
        if (!result.success || typeof result.totalMedals !== "number") {
          medalClaimFailedRef.current = true;
          medalRemainingRef.current = 0;
          activeMedalFlightsRef.current = 0;
          setDisplayedMedals(currentProfileMedals);
          setClaimingMedals(false);
          setMedalCenterFlight(null);
          setMedalCenterTapReady(false);
          setMedalFlightRequests([]);
          return;
        }

        if (result.awarded === false) {
          medalClaimFailedRef.current = true;
          medalRemainingRef.current = 0;
          activeMedalFlightsRef.current = 0;
          setDisplayedMedals(result.totalMedals);
          setClaimingMedals(false);
          setClaimedMedals(true);
          setMedalCenterFlight(null);
          setMedalCenterTapReady(false);
          setMedalFlightRequests([]);
          updateProfileField({ quizResultMedals: result.totalMedals });
          return;
        }

        const totalMedals = result.totalMedals;
        medalClaimTotalRef.current = totalMedals;
        setMedalCenterFlight((current) =>
          current ? { ...current, totalMedals } : current,
        );
      })();
    });
  }, [claimedMedals, claimingMedals, isResultTest, medalRating, onContinue, requireAuthAction, startMedalCollection, updateProfileField, user]);
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
  const menuConfig = {
    correct: { title: t("quiz.resultCorrect"), cards: results.correct, tone: "emerald" as const },
    incorrect: { title: t("quiz.resultIncorrect"), cards: results.incorrect, tone: "rose" as const },
    learned: { title: t("quiz.resultLearned"), cards: results.learned, tone: "amber" as const },
  } as const;
  const title = canUseSuperWater(locale)
    ? formatSuperWaterText(locale, t("quiz.resultFinishedTitle"))
    : t("quiz.resultFinishedTitle");
  const performanceMessage = canUseSuperWater(locale)
    ? formatSuperWaterText(
        locale,
        t(getQuizResultMessageKey(performance.messageKeys, results, selectedCount, chestOpened)),
      )
    : t(getQuizResultMessageKey(performance.messageKeys, results, selectedCount, chestOpened));
  const performanceMessageText = performanceMessage.replace(/^[^\p{L}\p{N}]+/u, "");
  const totalXp = getQuizResultRewardPoints(medalRating, selectedCount ?? 10) ?? 0;
  const resultStats = [
    {
      key: "xp",
      label: formatSuperWaterUppercaseText(locale, t("quiz.resultTotalXp")),
      value: formatNumber(locale, totalXp),
      icon: Star,
      className: "border-yellow-400 bg-transparent text-yellow-300",
      headerClassName: "bg-yellow-400",
    },
    {
      key: "accuracy",
      label: formatSuperWaterUppercaseText(locale, t("quiz.resultAccuracy")),
      value: `${formatNumber(locale, performance.accuracy)}%`,
      icon: Target,
      className: "border-lime-400 bg-transparent text-lime-300",
      headerClassName: "bg-lime-400",
    },
    {
      key: "time",
      label: formatSuperWaterUppercaseText(locale, t("quiz.resultTime")),
      value: formatQuizDuration(quizDurationSeconds),
      icon: Timer,
      className: "border-sky-400 bg-transparent text-sky-300",
      headerClassName: "bg-sky-400",
    },
  ] as const;
  const claimLabel = canUseSuperWater(locale)
    ? formatSuperWaterText(locale, t("quiz.claimMedals"))
    : t("quiz.claimMedals");
  const isCollectingMedals = claimingMedals && !claimedMedals;

  return (
    <div
      data-quiz-result-view
      data-quiz-result-stage="first"
      className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--background)] text-center"
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-hidden bg-[var(--background)] transition-opacity duration-500",
          !isCollectingMedals && "result-stagger-enter",
          isCollectingMedals ? "opacity-0" : "opacity-100",
        )}
        style={{ "--result-stagger-delay": "0ms" } as CSSProperties}
        data-result-animation-video
      >
        <div className="relative h-full max-h-full aspect-square max-w-full overflow-hidden bg-[var(--background)]">
          <video
            className="block h-full w-full object-contain"
            src={resultAnimationVideoSource}
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlay={(event) => {
              const audio = resultAnimationAudioRef.current;
              if (!audio) return;
              try {
                audio.currentTime = event.currentTarget.currentTime;
              } catch {
                // Audio/video synchronization is best effort on older WebViews.
              }
              audio.volume = 1;
              void audio.play().catch(() => undefined);
            }}
            onLoadedMetadata={(event) => {
              event.currentTarget.volume = 0;
            }}
            onTimeUpdate={(event) => {
              const audio = resultAnimationAudioRef.current;
              if (audio && Math.abs(audio.currentTime - event.currentTarget.currentTime) > 0.18) {
                try {
                  audio.currentTime = event.currentTarget.currentTime;
                } catch {
                  // Keep rendering if a WebView rejects a seek during startup.
                }
              }
              if (audio && Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0) {
                const remainingMs = Math.max(0, (event.currentTarget.duration - event.currentTarget.currentTime) * 1000);
                audio.volume = remainingMs < RESULT_VIDEO_AUDIO_FADE_OUT_MS
                  ? Math.min(1, remainingMs / RESULT_VIDEO_AUDIO_FADE_OUT_MS)
                  : 1;
              }
            }}
            onEnded={(event) => {
              event.currentTarget.volume = 0;
              resultAnimationAudioRef.current?.pause();
            }}
            aria-hidden="true"
          />
          <audio
            ref={resultAnimationAudioRef}
            src={resultAnimationVideoSource.includes("result_animation_2")
              ? RESULT_ANIMATION_AUDIO_SOURCES.result_animation_2
              : RESULT_ANIMATION_AUDIO_SOURCES.result_animation_1}
            preload="auto"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-[var(--background)] to-transparent sm:w-10"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-[var(--background)] to-transparent sm:w-10"
            aria-hidden="true"
          />
        </div>
      </div>

      <main
        className={cn(
          "h-[515px] min-h-0 w-full shrink-0 overflow-hidden transition-opacity duration-500",
          isCollectingMedals ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <div
          className="flex h-full w-full flex-col items-center overflow-y-auto rounded-2xl border border-transparent bg-transparent px-3 pb-0 pt-3 sm:px-4 sm:pt-4"
          data-result-summary-box
        >
        <h1
          data-result-finished-title
          className={cn(
            "shrink-0 text-4xl font-bold leading-tight text-white sm:text-6xl",
            "result-stagger-enter",
            canUseSuperWater(locale) && "font-super-water",
          )}
          style={{ "--result-stagger-delay": "100ms" } as CSSProperties}
        >
          {title}
        </h1>

        <p
          data-result-performance-message
          className={cn(
            "result-stagger-enter shrink-0 text-sm font-bold uppercase leading-none text-white/55 sm:text-base",
          )}
          style={{ "--result-stagger-delay": "160ms" } as CSSProperties}
        >
          {performanceMessageText}
        </p>

          <div
            className="result-stagger-enter relative top-[30px] flex w-full items-center justify-center gap-2 sm:gap-3"
            style={{ "--result-stagger-delay": "220ms" } as CSSProperties}
            data-result-stats
          >
            {resultStats.map(({ key, label, value, icon: Icon, className, headerClassName }) => (
              <div
                key={key}
                className={cn(
                  "flex aspect-[778/700] w-[98px] shrink-0 flex-col items-center overflow-hidden rounded-2xl border-2 bg-transparent p-0 text-center",
                  className,
                )}
              >
                <span className={cn(
                  "flex w-full shrink-0 items-center justify-center px-1 py-2 text-[0.58rem] font-bold uppercase leading-none text-[var(--background)] sm:py-2.5 sm:text-xs",
                  headerClassName,
                )}>
                  {label}
                </span>
                <div className="flex min-h-0 flex-1 items-center justify-center gap-1 text-lg font-bold leading-none sm:text-xl">
                  <Icon className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />
                  <span>{value}</span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="result-stagger-enter relative top-[30px] mt-3 flex w-full items-center justify-center gap-2 sm:mt-4 sm:gap-3"
            style={{ "--result-stagger-delay": "340ms" } as CSSProperties}
            data-result-summary-cards
          >
            {resultCards.map((card) => (
              <ResultCard
                key={card.key}
                resultKey={card.key}
                icon={card.icon}
                label={card.label}
                count={card.count}
                disabled={card.count === 0}
                onClick={() => setOpenMenu(card.key)}
              />
            ))}
          </div>

          <div
            className="relative top-[4px] mt-4 h-4 w-full max-w-[310px] shrink-0 sm:mt-5 sm:h-5"
            data-result-medals-heading
            aria-hidden="true"
          />
          <div
            ref={medalSourceRef}
            className={cn(
              "relative top-[4px] w-full max-w-[310px] shrink-0 transition-opacity duration-200",
              (claimingMedals || claimedMedals) && medalsFlightMounted
                ? "opacity-0"
                : "result-stagger-enter",
            )}
            style={{ "--result-stagger-delay": "220ms" } as CSSProperties}
            data-result-earned-medals
          >
            <QuizMedalRating
              rating={medalRating}
              className="w-full max-w-[310px] justify-between gap-0 px-2 sm:px-4"
            />
          </div>

          <div
            className="result-stagger-enter relative mt-auto w-full shrink-0 pt-3 sm:pt-4"
            style={{ "--result-stagger-delay": "460ms", top: "-60px" } as CSSProperties}
          >
            <button
              type="button"
              onClick={collectMedals}
              disabled={claimingMedals || claimedMedals}
              data-no-tap-vibrate
              data-result-claim-medals
              className="pointer-events-auto flex h-14 w-full items-center justify-center rounded-xl bg-[#f5a900] px-5 text-lg font-bold text-white shadow-[0_6px_0_#c77f00] transition-transform active:translate-y-1 active:shadow-[0_2px_0_#c77f00] disabled:pointer-events-none disabled:opacity-60 sm:h-16 sm:text-xl"
            >
              {claimLabel}
            </button>
          </div>
        </div>
      </main>

      {openMenu ? (
        <ResultMenu
          title={menuConfig[openMenu].title}
          cards={menuConfig[openMenu].cards}
          tone={menuConfig[openMenu].tone}
          onClose={() => setOpenMenu(null)}
        />
      ) : null}

      {showMedalHud && typeof document !== "undefined"
        ? createPortal(
            <div
              className="result-stagger-enter pointer-events-none fixed left-4 top-4 z-[260]"
              style={{ "--result-stagger-delay": "80ms" } as CSSProperties}
            >
              <RewardMedalHud
                medals={displayedMedals}
                pulse={medalPulse === null ? null : { key: medalPulse }}
                targetRef={medalTargetRef}
                size="large"
                showBackground={false}
                className="rounded-xl pr-3"
              />
            </div>,
            document.body,
          )
        : null}

      {medalFlightRequests.map((flightRequest) => (
        <RewardScatter
          key={flightRequest.flightId}
          medals={{
            amount: flightRequest.amount,
            source: flightRequest.source,
            sources: flightRequest.sources,
            target: flightRequest.target,
            placement: { origin: "center" },
            scatterOffset: { x: -48, y: -44 },
            iconSize: RESULT_MEDAL_CENTER_ICON_SIZE,
            zIndex: 200,
            arrivalSoundEffect: "points",
          }}
          onMedalArrive={(amountAwarded) => {
            if (medalClaimFailedRef.current) return;
            setDisplayedMedals((current) => current + amountAwarded);
            medalPulseSequenceRef.current += 1;
            setMedalPulse(medalPulseSequenceRef.current);
          }}
          onMedalsStart={() => {
            if (!medalClaimFailedRef.current) {
              setMedalsFlightMounted(true);
            }
          }}
          onMedalsComplete={() => {
            if (medalClaimFailedRef.current) return;
            activeMedalFlightsRef.current = Math.max(0, activeMedalFlightsRef.current - 1);
            setMedalFlightRequests((current) => current.filter((item) => item.flightId !== flightRequest.flightId));

            if (activeMedalFlightsRef.current > 0) return;

            if (medalRemainingRef.current > 0) {
              setMedalsFlightMounted(false);
              return;
            }

            if (medalPulseTimerRef.current !== null) {
              window.clearTimeout(medalPulseTimerRef.current);
            }
            medalPulseTimerRef.current = window.setTimeout(() => {
              medalPulseTimerRef.current = null;
              const finalMedals = medalClaimTotalRef.current ?? flightRequest.totalMedals;
              setDisplayedMedals(finalMedals);
              setClaimingMedals(false);
              setMedalsFlightMounted(false);
              setClaimedMedals(true);
              setMedalCenterFlight(null);
              setMedalCenterTapReady(false);
              setMedalFlightRequests([]);
              updateProfileField({ quizResultMedals: finalMedals });
              void refreshProfile();
              onContinue?.();
            }, RESULT_MEDAL_HUD_PULSE_DURATION_MS);
          }}
        />
      ))}

      {medalCenterFlight && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-0 z-[140]"
              data-result-medal-center-flight
            >
              {medalCenterTapReady && medalCenterFlight.remaining > 0 ? (
                <button
                  type="button"
                  className="pointer-events-auto fixed inset-0 z-[139] cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-none"
                  onClick={collectNextMedal}
                  data-no-tap-vibrate
                  aria-label={claimLabel}
                />
              ) : null}
              {Array.from({ length: medalCenterFlight.remaining }, (_, index) => {
                const centerX = medalCenterFlight.center.left;
                const centerY = medalCenterFlight.center.top;

                return (
                  <span
                    key={`center-medal-${index}`}
                    aria-hidden="true"
                    className="result-medal-center-flight fixed left-0 top-0 block"
                    style={{
                      width: RESULT_MEDAL_CENTER_ICON_SIZE,
                      height: RESULT_MEDAL_CENTER_ICON_SIZE,
                      "--result-medal-center-x": `${centerX}px`,
                      "--result-medal-center-y": `${centerY}px`,
                    } as CSSProperties}
                  >
                    <span
                      className="result-medal-center-wobble block size-full"
                    >
                      <img
                        src={RESULT_MEDAL_IMAGE_SRC}
                        alt=""
                        width={RESULT_MEDAL_CENTER_ICON_SIZE}
                        height={RESULT_MEDAL_CENTER_ICON_SIZE}
                        draggable={false}
                        className="size-full object-contain"
                      />
                    </span>
                  </span>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * The previous result UI is intentionally kept intact for future reuse while
 * the result flow is being rebuilt screen by screen.
 */
export function LegacyResultView({
  mode,
  results,
  selectedCount,
  chestOpened,
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
  streakRewardStreak?: number;
  streakRewardPoints?: number;
  locked?: boolean;
  onRestart: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { stats } = useProgressStats();
  const { openLeaderboard } = useLeaderboardOverlay();
  const dayStreakOverlay = useOptionalMobileDayStreakOverlay();
  const { data: leaderboardData } = useLeaderboardData({ refreshOnMount: true });
  const [openMenu, setOpenMenu] = useState<
    "correct" | "incorrect" | "learned" | null
  >(null);
  const hasTriggeredResult = useRef(false);
  const performance = getQuizPerformanceSummary(
    mode,
    results,
    selectedCount,
    chestOpened,
  );
  const medalRating = useMemo(() => {
    const accuracy = performance.accuracy;
    if (accuracy >= 90) return 5;
    if (accuracy >= 75) return 4;
    if (accuracy >= 60) return 3;
    if (accuracy >= 40) return 2;
    return 1;
  }, [performance.accuracy]);
  const leaderboardStanding = leaderboardData
    ? t("leaderboard.yourStanding", {
        position: formatNumber(locale, leaderboardData.viewer.position),
      })
    : t("leaderboard.positionLoading");
  const rankLabel = getRankLabel(stats.rank, locale);
  const rankAccentColor =
    RANK_ACCENT_COLORS[stats.rank.id as keyof typeof RANK_ACCENT_COLORS] ??
    RANK_ACCENT_COLORS.baslangic;
  const formatResultDisplayText = (text: string) =>
    canUseSuperWater(locale) ? formatSuperWaterText(locale, text) : text;
  const runAfterDailyStreakReminder = useCallback(
    (action: () => void) => {
      if (!dayStreakOverlay) {
        action();
        return;
      }

      dayStreakOverlay.requestAutoOpenAfterQuizResult(action);
    },
    [dayStreakOverlay],
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
      <div
        data-quiz-result-panel
        data-testid="quiz-result-panel"
        className="animate-screen-pop relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-background-card px-4 py-4 text-center shadow-sm sm:px-6 sm:py-6 max-lg:max-w-none max-lg:translate-y-2 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:px-5 max-lg:py-4"
      >
        <div className="flex -translate-y-6 flex-col items-center gap-2.5 max-lg:gap-2 sm:-translate-y-7">
          <button
            type="button"
            onClick={() => {
              openLeaderboard();
            }}
            disabled={locked}
            aria-label={t("leaderboard.title")}
            className="flex -translate-y-3 flex-col items-center gap-1 text-brand transition-opacity disabled:pointer-events-none disabled:opacity-50 sm:-translate-y-4"
          >
            <span
              data-leaderboard-scope
              className="font-super-water text-sm font-bold text-white sm:text-base"
            >
              {formatResultDisplayText(t("leaderboard.scope"))}
            </span>
            <span
              data-leaderboard-standing
              className={cn(
                "text-[2.6rem] font-bold leading-none text-yellow-400 sm:text-5xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatResultDisplayText(leaderboardStanding)}
            </span>
          </button>
          <div className="relative flex h-36 w-full items-center justify-center sm:h-52">
            <RankIcon
              icon={stats.rank.icon}
              className="relative z-10 size-32 animate-trophy-intro-grow drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] sm:size-40"
              sizes="(max-width: 640px) 160px, 220px"
            />
          </div>
          <h2
            className={cn(
              "translate-y-2 scale-[1.35] text-2xl font-bold sm:translate-y-3 sm:text-3xl",
              canUseSuperWater(locale) && "font-super-water",
            )}
            style={{
              color: `color-mix(in srgb, ${rankAccentColor} 65%, white)`,
            }}
          >
            {formatResultDisplayText(rankLabel)}
          </h2>
        </div>

        <div
          className="flex w-full translate-y-2 flex-col items-center"
          data-result-lower-section
        >
          <div className="relative flex -translate-y-4 items-center justify-center sm:-translate-y-5">
            <QuizMedalRating
              rating={medalRating}
              className="mt-0.5"
            />
          </div>

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
              onClick={() => runAfterDailyStreakReminder(onRestart)}
              aria-label={t("quiz.restart")}
              data-result-action="play"
              className="size-20"
            >
            </ImageActionButton>
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.menu}
              imageSizes="56px"
              disabled={locked}
              onClick={() => runAfterDailyStreakReminder(onExit)}
              aria-label={t("quiz.exit")}
              data-result-action="menu"
              className="size-14"
            >
            </ImageActionButton>
          </div>
        </div>
      </div>

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
  nonInteractive = false,
}: {
  resultKey: "correct" | "incorrect" | "learned";
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  disabled?: boolean;
  onClick?: () => void;
  nonInteractive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      data-result-card={resultKey}
      className={cn(
        "flex aspect-[778/700] w-[98px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 bg-transparent p-2 text-center transition-[filter,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:p-3",
        RESULT_CARD_TONES[resultKey],
        nonInteractive
          ? "cursor-default"
          : disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:brightness-105 active:brightness-95",
      )}
    >
      {resultKey === "learned" ? (
        <span
          className="mx-auto size-8 shrink-0 bg-[#fbbf24] sm:size-9"
          style={{
            maskImage: 'url("/quiz/result-learned-trophy.png")',
            WebkitMaskImage: 'url("/quiz/result-learned-trophy.png")',
            maskPosition: "center",
            WebkitMaskPosition: "center",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskSize: "contain",
          }}
          aria-hidden="true"
        />
      ) : (
        <Icon
          className="mx-auto size-8 shrink-0 stroke-[3.5] text-current sm:size-9"
          strokeWidth={3.5}
          aria-hidden="true"
        />
      )}
      <p className="mt-1 text-2xl font-bold text-current sm:text-3xl">{count}</p>
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
  const chestUnlocked = accuracy >= 70 && Boolean(previewPair) && !chestOpened;

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
  cards: readonly VocabularyCard[];
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
      className="animate-screen-pop fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm max-lg:bg-background max-lg:p-0 max-lg:backdrop-blur-none"
      data-result-menu
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background-card shadow-2xl max-lg:h-full max-lg:max-h-none max-lg:rounded-none max-lg:border-0"
        data-result-menu-panel
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-3 -translate-y-1/2 bg-black dark:bg-white"
          aria-hidden="true"
        />
        <div
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-white/20 p-4 text-white",
            toneClassName[tone],
          )}
          data-result-menu-header
        >
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 hover:text-white"
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
