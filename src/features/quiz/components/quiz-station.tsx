"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  GraduationCap,
  Lock,
  Medal,
  RotateCcw,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LANGUAGES } from "@/data/languages";
import { TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getCardExampleTranslation, getCardTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { buildQuizQuestion, getTierRequirement, isAnswerSimilarEnough } from "@/features/quiz/quiz-engine";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useProgressStats } from "@/features/progress/progress-client";
import { awardChestPoints } from "@/features/quiz/actions";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { getChestTierByCount, CHEST_TIER_BORDER_CLASSES, CHEST_TIER_UI_CLASSES, type ChestTierDefinition } from "@/features/quiz/chest-rewards";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCards, getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import confetti from "canvas-confetti";
import type {
  InventoryCard,
  LanguageCode,
  LimitErrorCode,
  PracticeMode,
  QuizQuestion,
  VocabularyCard,
} from "@/types/domain";

type QuizPhase = "language" | "count" | "quiz" | "celebration" | "result" | "chest";

export type { QuizPhase };

const COUNT_OPTIONS = [10, 20, 30, 40, 50, 75, 100];

const CHOICE_OPTION_COLORS = ["bg-red-500", "bg-blue-500", "bg-amber-400", "bg-emerald-500"] as const;

interface QuizItem {
  card: VocabularyCard;
  inventoryCard: InventoryCard;
  questionType: "choice" | "text";
  question: QuizQuestion | { correctAnswer: string };
  willLearn: boolean;
}

interface QuizResult {
  correct: VocabularyCard[];
  incorrect: VocabularyCard[];
  learned: VocabularyCard[];
}

type QuizPerformanceLevel = "high" | "medium" | "low";
type QuizPerformanceMessageKey =
  | "quiz.resultMessageHigh1"
  | "quiz.resultMessageHigh2"
  | "quiz.resultMessageHigh3"
  | "quiz.resultMessageMedium1"
  | "quiz.resultMessageMedium2"
  | "quiz.resultMessageMedium3"
  | "quiz.resultMessageLow1"
  | "quiz.resultMessageLow2"
  | "quiz.resultMessageLow3";

type QuizPerformanceSummary = {
  accuracy: number;
  chestUnlocked: boolean;
  icon: typeof Trophy;
  level: QuizPerformanceLevel;
  messageKeys: readonly QuizPerformanceMessageKey[];
  ringClassName: string;
  textClassName: string;
};

const QUIZ_RESULT_MESSAGE_KEYS: Record<QuizPerformanceLevel, readonly QuizPerformanceMessageKey[]> = {
  high: ["quiz.resultMessageHigh1", "quiz.resultMessageHigh2", "quiz.resultMessageHigh3"],
  medium: ["quiz.resultMessageMedium1", "quiz.resultMessageMedium2", "quiz.resultMessageMedium3"],
  low: ["quiz.resultMessageLow1", "quiz.resultMessageLow2", "quiz.resultMessageLow3"],
};

function getQuizResultMessageKey(
  messageKeys: readonly QuizPerformanceMessageKey[],
  results: QuizResult,
  selectedCount: number | null,
  chestOpened: boolean,
) {
  if (messageKeys.length === 0) {
    return "quiz.resultMessageMedium1" as const;
  }

  const seed = [
    String(selectedCount ?? "none"),
    chestOpened ? "opened" : "closed",
    ...results.correct.map((card) => card.id),
    "|",
    ...results.incorrect.map((card) => card.id),
    "|",
    ...results.learned.map((card) => card.id),
  ].join(":");

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return messageKeys[hash % messageKeys.length] ?? messageKeys[0];
}

export function QuizStation({
  mode,
  onPhaseChange,
  onBackToMode,
}: {
  mode: PracticeMode;
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
  const { refreshStats } = useProgressStats();
  const chestRewardsEnabled = mode === "active";

  const [phase, setPhase] = useState<QuizPhase>("language");

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [deck, setDeck] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [textAnswer, setTextAnswer] = useState("");
  const [textResult, setTextResult] = useState<"idle" | "correct" | "incorrect">("idle");
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<QuizResult>({ correct: [], incorrect: [], learned: [] });
  const [lastLearned, setLastLearned] = useState<VocabularyCard | null>(null);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const [chestOpened, setChestOpened] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [desktopCardFace, setDesktopCardFace] = useState<"front" | "back">("back");
  const [mobileCardOpen, setMobileCardOpen] = useState(false);
  const [mobileCardFace, setMobileCardFace] = useState<"front" | "back">("back");
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((language) => ({
        ...language,
        count: filterInventoryCards({ cards, language: language.code, status: mode }).length,
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
    return filterInventoryCards({ cards, language: selectedLanguage, status: mode }).map((item) => item.card);
  }, [cards, mode, selectedLanguage]);

  const buildDeck = useCallback(
    (language: LanguageCode, count: number | null) => {
      const source = filterInventoryCards({ cards, language, status: mode }).map((item) => item.card);
      const limited = count ? source.slice(0, count) : source;
      const shuffled = shuffle(limited);

      const items: QuizItem[] = shuffled.map((card) => {
        const inventoryCard = cards.find((item) => item.cardId === card.id)!;
        const requirement = getTierRequirement(card.tier);
        const willLearn =
          inventoryCard.status !== "learned" && inventoryCard.correctCount + 1 >= requirement;

        if (mode === "active" && willLearn) {
          return {
            card,
            inventoryCard,
            questionType: "text",
            question: { correctAnswer: card.term },
            willLearn: true,
          };
        }

        return {
          card,
          inventoryCard,
          questionType: "choice",
          question: buildQuizQuestion(card, VOCABULARY_CARDS, getStudyLocale(card.language, locale)),
          willLearn: false,
        };
      });

      setDeck(items);
      setCurrentIndex(0);
      setShowingAnswer(false);
      setTextAnswer("");
      setTextResult("idle");
      setLastAnswerCorrect(null);
      setResults({ correct: [], incorrect: [], learned: [] });
      setChestOpened(false);
      setPhase("quiz");
    },
    [cards, mode, locale],
  );

  const resetQuestionUi = useCallback(() => {
    setShowingAnswer(false);
    setTextAnswer("");
    setTextResult("idle");
    setLastAnswerCorrect(null);
    setDesktopCardFace("back");
    setMobileCardFace("back");
    setMobileCardOpen(false);
  }, []);

  const advanceQuiz = useCallback(
    ({
      bypassCelebration = false,
      resultsOverride,
    }: {
      bypassCelebration?: boolean;
      resultsOverride?: QuizResult;
    } = {}) => {
      if (!bypassCelebration && lastLearned) {
        setPhase("celebration");
        return;
      }

      if (currentIndex + 1 >= deck.length) {
        const summary = getQuizPerformanceSummary(mode, resultsOverride ?? results, selectedCount, chestOpened);
        if (summary.chestUnlocked) {
          setPhase("chest");
          return;
        }
        setPhase("result");
        return;
      }

      setCurrentIndex((current) => current + 1);
      resetQuestionUi();
    },
    [chestOpened, currentIndex, deck.length, lastLearned, mode, resetQuestionUi, results, selectedCount],
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
    },
    [],
  );

  function handleSelectLanguage(language: LanguageCode) {
    setSelectedLanguage(language);
    const count = filterInventoryCards({ cards, language, status: mode }).length;

    if (count < 10) {
      buildDeck(language, null);
      return;
    }

    setSelectedCount(null);
    setChestOpened(false);
    setPhase("count");
  }

  function handleStartCount(count: number) {
    if (!selectedLanguage) return;
    buildDeck(selectedLanguage, count);
  }

  async function handleAnswer(answer: string, isCorrect: boolean) {
    if (showingAnswer) return;

    const item = deck[currentIndex];
    const inventoryCard = item.inventoryCard;
    const correctAnswer =
      item.questionType === "choice"
        ? (item.question as QuizQuestion).correctAnswer
        : (item.question as { correctAnswer: string }).correctAnswer;

    if (item.willLearn && isCorrect) {
      const effectivePlan = entitlements?.effectivePlan ?? "free";
      const learnedLimit = PLAN_LIMITS[effectivePlan].learnedCards;

      if (effectivePlan === "free" && typeof learnedLimit === "number") {
        const learnedCount = cards.filter((card) => card.status === "learned").length;

        if (learnedCount >= learnedLimit) {
          const nextResults: QuizResult = {
            correct: [...results.correct, item.card],
            incorrect: results.incorrect,
            learned: results.learned,
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

    requireAuthAction(() => {
      const willLearn = item.willLearn && isCorrect;

      playSoundEffect(isCorrect ? "correct" : "incorrect");
      vibrate(isCorrect ? "correct" : "incorrect");

      setResults((current) => ({
        correct: isCorrect ? [...current.correct, item.card] : current.correct,
        incorrect: !isCorrect ? [...current.incorrect, item.card] : current.incorrect,
        learned: willLearn ? [...current.learned, item.card] : current.learned,
      }));

      if (willLearn) {
        setLastLearned(item.card);
      }

      setShowingAnswer(true);
      setTextResult(isCorrect ? "correct" : "incorrect");
      setLastAnswerCorrect(isCorrect);
      setDesktopCardFace("front");
      if (mobileCardOpen) {
        setMobileCardFace("front");
      }

      void recordAnswer({
        cardId: item.card.id,
        selectedAnswer: answer,
        correctAnswer,
        isCorrect,
        mode,
      });
    }, {
      nextPath: `/learn?mode=${mode}`,
    });
  }

  function handleNext() {
    advanceQuiz();
  }

  function handleContinueFromCelebration() {
    setLastLearned(null);
    advanceQuiz({ bypassCelebration: true });
  }

  function handleRestart() {
    if (selectedLanguage) {
      const count = filterInventoryCards({ cards, language: selectedLanguage, status: mode }).length;

      if (count < 10) {
        buildDeck(selectedLanguage, null);
        return;
      }
    }

    setChestOpened(false);
    setPhase("count");
  }

  function handleExit() {
    router.push("/my-cards");
  }

  async function handleChestComplete(tier: ChestTierDefinition["tier"]) {
    if (chestOpened) {
      setPhase("result");
      return;
    }

    const result = await awardChestPoints(tier);

    if (result.success) {
      setChestOpened(true);
      await refreshStats();
    }

    setPhase("result");
  }

  if (!hydrated) {
    return <EmptyState title={t("quiz.loadingTitle")} description={t("quiz.loadingDescription")} />;
  }

  if (languageStats.length === 0) {
    return (
      <EmptyState
        title={t(mode === "active" ? "inventory.emptyAnyTitle" : "inventory.emptyAnyLearnedTitle")}
        description={t(mode === "active" ? "inventory.emptyAnyDescription" : "quiz.noLearnedDescription")}
        action={
          <Button onClick={() => router.push("/card-draw")}>{t("quiz.backToDraw")}</Button>
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
          onSelect={handleSelectLanguage}
          onBack={onBackToMode}
        />
      </div>
    );
  }

  if (phase === "count" && selectedLanguage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <CountSelection
          mode={mode}
          language={selectedLanguage}
          availableCount={availableCards.length}
          selectedCount={selectedCount}
          onSelect={(count) => {
            setSelectedCount(count);
            handleStartCount(count);
          }}
          onBack={() => setPhase("language")}
        />
      </div>
    );
  }

  if (phase === "celebration" && lastLearned) {
    return (
      <CelebrationView
        card={lastLearned}
        onContinue={handleContinueFromCelebration}
      />
    );
  }

  if (phase === "result") {
    return (
      <QuizViewportOverlay
        learnPagePhase="result"
        overlay="result"
        className="animate-screen-pop fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-background p-4 max-lg:bottom-16 max-lg:p-0 lg:bottom-0 lg:top-16"
      >
        <div className="flex h-full w-full max-w-3xl items-center justify-center">
          <ResultView
            mode={mode}
            results={results}
            selectedCount={selectedCount}
            chestOpened={chestOpened}
            onRestart={handleRestart}
            onExit={handleExit}
          />
        </div>
      </QuizViewportOverlay>
    );
  }

  if (chestRewardsEnabled && phase === "chest" && selectedCount) {
    const tier = getChestTierByCount(selectedCount);

    if (tier) {
      return (
        <QuizViewportOverlay
          overlay="chest"
          className="animate-screen-pop fixed inset-0 z-40 flex items-center justify-center bg-background p-4 lg:inset-x-0 lg:bottom-0 lg:top-16"
        >
          <ChestOpeningView tier={tier} onComplete={() => handleChestComplete(tier.tier)} />
        </QuizViewportOverlay>
      );
    }
  }

  const item = deck[currentIndex];

  if (!item) {
    return (
      <EmptyState
        title={t(mode === "active" ? "quiz.noActiveTitle" : "quiz.noLearnedTitle")}
        description={t(mode === "active" ? "quiz.noActiveDescription" : "quiz.noLearnedDescription")}
        action={
          <Link href="/card-draw" className={buttonClassName("primary", "md")}>
            {t("quiz.backToDraw")}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <MobileQuizTopBars
        mode={mode}
        item={item}
        currentIndex={currentIndex}
        total={deck.length}
        showingAnswer={showingAnswer}
        lastAnswerCorrect={lastAnswerCorrect}
        onShowCard={() => {
          setMobileCardOpen(true);
          setMobileCardFace(showingAnswer ? "front" : "back");
        }}
      />
      <div
        className="animate-screen-pop mx-auto flex h-full w-full max-w-5xl flex-col justify-center bg-background max-lg:pt-32"
        data-learn-quiz-page="quiz"
      >
        <div className="grid gap-6 max-sm:gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="order-2 flex flex-col justify-center gap-4 lg:order-1">
            <QuizCounter currentIndex={currentIndex} total={deck.length} />
            <QuizProgressHeader
              mode={mode}
              item={item}
              onShowCard={() => {
                setMobileCardOpen(true);
                setMobileCardFace(showingAnswer ? "front" : "back");
              }}
            />
            <div className="flex flex-1 flex-col justify-center">
              {item.questionType === "choice" ? (
                <ChoiceQuestion
                  key={currentIndex}
                  item={item}
                  showingAnswer={showingAnswer}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                />
              ) : (
                <TextQuestion
                  key={currentIndex}
                  item={item}
                  textAnswer={textAnswer}
                  textResult={textResult}
                  showingAnswer={showingAnswer}
                  onChange={setTextAnswer}
                  onSubmit={handleAnswer}
                  onNext={handleNext}
                />
              )}
            </div>
          </div>

          <div className="order-1 hidden items-center justify-center lg:order-2 lg:flex lg:h-[440px]">
            <div className="h-[440px] w-auto focus:outline-none" aria-hidden="true">
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={desktopCardFace}
                flippable={false}
                className="h-full w-auto min-h-0 max-w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {mobileCardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 lg:hidden"
          onClick={() => setMobileCardOpen(false)}
        >
          <div className="relative w-full max-w-[260px]" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMobileCardOpen(false)}
              className="absolute -top-12 right-0 inline-flex size-10 items-center justify-center rounded-full bg-background-card text-foreground shadow-sm focus:outline-none"
              aria-label={t("common.close")}
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div
              role="button"
              tabIndex={showingAnswer ? 0 : -1}
              aria-disabled={!showingAnswer}
              onClick={() => {
                if (showingAnswer) {
                  setMobileCardFace((current) => (current === "front" ? "back" : "front"));
                }
              }}
              onKeyDown={(event) => {
                if (showingAnswer && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setMobileCardFace((current) => (current === "front" ? "back" : "front"));
                }
              }}
              className={cn(
                "w-full focus:outline-none",
                showingAnswer ? "cursor-pointer" : "cursor-default",
              )}
              aria-label={t("cards.flip")}
            >
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={mobileCardFace}
                flippable={false}
                className="w-full aspect-[2.5/3.5] min-h-0 h-auto"
              />
            </div>

            {!showingAnswer ? (
              <div className="mt-5 flex flex-col items-center text-foreground-inverse">
                <Lock className="size-8" aria-hidden="true" />
                <p className="mt-2 text-center text-sm font-semibold">{t("quiz.showCardLocked")}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <CardDetailsDialog card={item.card} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <UpgradeDialog
        open={limitError !== null}
        errorCode={limitError}
        onOpenChange={(open) => {
          if (!open) {
            setLimitError(null);
          }
        }}
      />
    </>
  );
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function LanguageSelection({
  mode,
  languageStats,
  hiddenLanguageCode,
  selectedLanguage,
  onSelect,
  onBack,
}: {
  mode: PracticeMode;
  languageStats: Array<{ code: LanguageCode; count: number; nativeName: string }>;
  hiddenLanguageCode: LanguageCode | null;
  selectedLanguage: LanguageCode | null;
  onSelect: (language: LanguageCode) => void;
  onBack?: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const hiddenLanguageName = hiddenLanguageCode ? getLanguageDisplayName(hiddenLanguageCode, locale) : null;

  return (
    <div
      data-quiz-language-selection
      className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background p-5 text-foreground sm:p-8 lg:min-w-[56rem] lg:max-w-5xl lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-center gap-3">
            <Badge className="border-transparent bg-white/10 text-foreground">
              {mode === "active" ? t("inventory.learn") : t("inventory.repeatPractice")}
            </Badge>
          </div>
          <h2 className="mt-4 text-center text-lg font-semibold text-foreground lg:text-2xl">{t("quiz.chooseLanguageTitle")}</h2>
          {hiddenLanguageName ? (
            <p className="mt-2 text-center text-xs leading-5 text-foreground/65 lg:text-sm">
              {t("quiz.hiddenSiteLanguageHint", { language: hiddenLanguageName })}
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
                  aria-pressed={selectedLanguage === language.code}
                  onClick={() => onSelect(language.code)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md border border-black/10 bg-white p-3 text-left text-sm font-semibold text-black transition-colors hover:bg-neutral-100 lg:p-4 lg:text-base",
                    selectedLanguage === language.code && "border-black/40 bg-neutral-100",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-black">
                    <LanguageFlag code={language.code} />
                    <span className="truncate">{getLanguageDisplayName(language.code, locale)}</span>
                  </span>
                  <Badge className="border-transparent bg-black/10 text-black">{formatCards(locale, language.count)}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center">
              <div className="max-w-md">
                <p className="text-base font-semibold text-foreground">{t("quiz.noPracticeLanguagesTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-foreground/70">
                  {t("quiz.noPracticeLanguagesDescription")}
                </p>
              </div>
            </div>
          )}
            </div>
          </div>

          {onBack ? (
            <div className="mt-5 flex justify-center">
              <Button variant="ghost" className="text-foreground hover:bg-background-muted hover:text-foreground" onClick={onBack}>
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
  onSelect,
  onBack,
}: {
  mode: PracticeMode;
  language: LanguageCode;
  availableCount: number;
  selectedCount: number | null;
  onSelect: (count: number) => void;
  onBack: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const showChestTiers = mode === "active";

  return (
    <div
      data-quiz-count-selection
      className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background-card p-5 sm:p-8 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4"
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto">
        <div className="flex flex-col items-center text-center">
          <div className="flex justify-center lg:hidden">
            <Image
              src="/mascots/mascot5.png"
              alt=""
              width={80}
              height={80}
              className="size-20 object-contain"
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{t("quiz.chooseCountTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-secondary">
            {t("quiz.chooseCountDescription", {
              language: getLanguageDisplayName(language, locale),
              count: availableCount,
            })}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div className="grid w-full grid-cols-4 gap-2 sm:grid-cols-7">
            {COUNT_OPTIONS.map((count) => {
              const disabled = count > availableCount;
              const chestTier = getChestTierByCount(count);

              const chestBase = showChestTiers && chestTier ? CHEST_TIER_UI_CLASSES[chestTier.tier].base : null;

              return (
                <button
                  key={count}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(count)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center rounded-md border-2 px-2 py-2 text-sm font-semibold transition-colors sm:min-h-[72px] sm:py-3",
                    chestBase
                      ? cn("text-white", chestBase, selectedCount === count ? "ring-2 ring-white/60" : "hover:brightness-110")
                      : [
                          selectedCount === count
                            ? "bg-background-inverse text-foreground-inverse hover:brightness-110"
                            : "bg-background text-foreground-secondary hover:bg-background-card",
                          "border-border",
                        ],
                    disabled && "opacity-40",
                    showChestTiers && chestTier ? CHEST_TIER_BORDER_CLASSES[chestTier.tier] : "border-border",
                  )}
                >
                  <span>{count}</span>
                  {showChestTiers && chestTier ? (
                    <span className="text-[10px] font-medium text-white sm:text-xs">
                      {t(chestTier.labelKey)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Button variant="ghost" onClick={onBack}>
            {t("common.back")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuizProgressHeader({
  mode,
  item,
  onShowCard,
}: {
  mode: PracticeMode;
  item: QuizItem;
  onShowCard: () => void;
}) {
  const t = useT();
  const style = TIER_STYLES[item.card.tier];

  return (
    <div className="rounded-lg border border-transparent bg-transparent p-3 max-sm:p-2 sm:p-5 max-lg:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {item.questionType === "text"
            ? t("quiz.learningQuizBadge")
            : mode === "learned"
              ? t("quiz.reviewBadge")
              : t("quiz.activeBadgeWithTier", { tier: item.card.tier })}
        </Badge>
        <button
          type="button"
          onClick={onShowCard}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold text-foreground-inverse transition-colors hover:brightness-110 active:brightness-90",
            style.accent,
          )}
        >
          {t("quiz.showCard")}
        </button>
      </div>
    </div>
  );
}

function MobileQuizTopBars({
  mode,
  item,
  currentIndex,
  total,
  showingAnswer,
  lastAnswerCorrect,
  onShowCard,
}: {
  mode: PracticeMode;
  item: QuizItem;
  currentIndex: number;
  total: number;
  showingAnswer: boolean;
  lastAnswerCorrect: boolean | null;
  onShowCard: () => void;
}) {
  const t = useT();
  const style = TIER_STYLES[item.card.tier];
  const requirement = TIER_REQUIREMENTS[item.card.tier];
  const delta = showingAnswer && lastAnswerCorrect !== null ? (lastAnswerCorrect ? 1 : -1) : 0;
  const displayCorrectCount = Math.max(0, Math.min(requirement, item.inventoryCard.correctCount + delta));
  const learningProgress = Math.min(100, (displayCorrectCount / requirement) * 100);
  const quizProgress = Math.min(100, ((currentIndex + (showingAnswer ? 1 : 0)) / total) * 100);

  return (
    <div className="fixed inset-x-0 top-0 z-30 flex flex-col lg:hidden">
      <div className="flex flex-col gap-1 bg-black px-4 py-2 text-white">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span>{t("quiz.activeBadge")}</span>
          <span>
            {currentIndex + 1} / {total}
          </span>
        </div>
        <Progress value={quizProgress} className="bg-[#131313]" indicatorClassName="bg-red-500" />
      </div>

      <div className={cn("flex flex-col gap-1 px-4 py-2 text-white", style.accent)}>
        <div className="flex items-center justify-between">
          <Badge className="border-transparent bg-white/20 text-white">
            {item.questionType === "text"
              ? t("quiz.learningQuizBadge")
              : mode === "learned"
                ? t("quiz.reviewBadge")
                : t("quiz.activeBadgeWithTier", { tier: item.card.tier })}
          </Badge>
          <button
            type="button"
            onClick={onShowCard}
            className={cn(
              "rounded-md bg-white px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/90",
              style.text,
            )}
          >
            {t("quiz.showCard")}
          </button>
        </div>
        {item.questionType === "choice" && mode === "active" ? (
          <>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{item.inventoryCard.status === "learned" ? t("cards.learned") : t("quiz.cardLearningProcess")}</span>
              <span>
                {displayCorrectCount}/{requirement}
              </span>
            </div>
            <Progress value={learningProgress} className="bg-[#131313]" indicatorClassName="bg-white" />
          </>
        ) : null}
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

function ChoiceQuestion({
  item,
  showingAnswer,
  onAnswer,
  onNext,
}: {
  item: QuizItem;
  showingAnswer: boolean;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onNext: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question as QuizQuestion;
  const answerLocale = getStudyLocale(item.card.language, locale);

  return (
    <div className="animate-screen-pop flex flex-col gap-4 rounded-lg border border-transparent bg-transparent p-4 max-sm:p-3 sm:p-8">
      <p className="text-sm font-semibold text-foreground-muted">
        {t("quiz.questionPrompt", { language: getLanguageDisplayName(answerLocale, locale) })}
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
        <h2 className="font-display text-5xl font-semibold leading-none text-foreground max-sm:text-3xl sm:text-6xl">
          {item.card.term}
        </h2>
      </div>

      <div className="grid gap-3">
        {question.options.map((option, index) => {
          const isCorrectOption = option === question.correctAnswer;
          const optionColor = CHOICE_OPTION_COLORS[index % CHOICE_OPTION_COLORS.length];

          return (
            <button
              key={option}
              type="button"
              data-quiz-option={option}
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              className={cn(
                "min-h-14 rounded-md px-4 py-3 text-left text-sm font-semibold text-foreground-inverse transition-colors hover:brightness-110 disabled:cursor-default",
                optionColor,
                showingAnswer && isCorrectOption && "bg-emerald-500 hover:brightness-100",
                showingAnswer && !isCorrectOption && "bg-background-inverse hover:brightness-100",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {showingAnswer ? (
        <div className="mt-6 max-sm:mt-3 flex flex-col gap-3 sm:flex-row">
          <Button className="w-full bg-brand hover:bg-brand-hover" onClick={onNext}>
            {t("quiz.nextCard")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TextQuestion({
  item,
  textAnswer,
  textResult,
  showingAnswer,
  onChange,
  onSubmit,
  onNext,
}: {
  item: QuizItem;
  textAnswer: string;
  textResult: "idle" | "correct" | "incorrect";
  showingAnswer: boolean;
  onChange: (value: string) => void;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onNext: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question as { correctAnswer: string };
  const exampleTranslation = item.card.examples[0] ? getCardExampleTranslation(item.card.examples[0], locale) : "";
  const isMobileViewport = useSyncExternalStore(
    (callback) => {
      window.addEventListener("resize", callback);
      return () => window.removeEventListener("resize", callback);
    },
    () => window.innerWidth < 1024,
    () => false,
  );
  const [splashDone, setSplashDone] = useState(false);
  const [splashColor] = useState(() => CHOICE_OPTION_COLORS[Math.floor(Math.random() * CHOICE_OPTION_COLORS.length)]);

  useEffect(() => {
    if (!isMobileViewport) return;
    const timer = window.setTimeout(() => setSplashDone(true), 1200);
    return () => window.clearTimeout(timer);
  }, [isMobileViewport]);

  function handleSubmit() {
    if (showingAnswer) return;
    const isCorrect = isAnswerSimilarEnough(textAnswer, question.correctAnswer);
    onSubmit(textAnswer, isCorrect);
  }

  return (
    <>
      {isMobileViewport && !splashDone ? (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-learning-quiz-splash lg:hidden",
            splashColor,
          )}
          aria-hidden="true"
        >
          <span className="px-6 text-center text-3xl font-bold text-white sm:text-4xl">
            {t("quiz.learningQuizSplash")}
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "animate-screen-pop flex flex-col gap-4 rounded-lg border border-transparent bg-transparent p-4 max-sm:p-3 sm:p-8 max-lg:-mt-12",
          splashDone || !isMobileViewport ? "opacity-100" : "opacity-0",
        )}
      >
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-amber-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
      </div>

      <p className="text-sm font-semibold text-foreground-muted">
        {t("quiz.learningQuizPrompt", { language: getLanguageDisplayName(item.card.language, locale) })}
      </p>
      <div className="flex items-center justify-center">
        <h2 className="font-display text-5xl font-semibold leading-none text-foreground max-sm:text-3xl sm:text-6xl">
          {getCardTranslation(item.card, locale)}
        </h2>
      </div>

      <div>
        <input
          type="text"
          value={textAnswer}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !showingAnswer) {
              handleSubmit();
            }
          }}
          disabled={showingAnswer}
          placeholder={t("quiz.learningQuizPlaceholder")}
          className={cn(
            "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none placeholder:text-foreground-muted focus:border-foreground",
            showingAnswer && textResult === "correct" && "border-emerald-500 bg-emerald-50",
            showingAnswer && textResult === "incorrect" && "border-rose-500 bg-rose-50",
          )}
        />

        {showingAnswer ? (
          <div className="mt-4 max-sm:mt-2 space-y-3">
            <div className="flex items-center gap-3">
              {textResult === "correct" ? (
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="size-5 text-rose-600" aria-hidden="true" />
              )}
              <p className="font-semibold text-foreground">
                {textResult === "correct"
                  ? t("quiz.correctAnswer")
                  : t("quiz.correctAnswerWithValue", { answer: question.correctAnswer })}
              </p>
            </div>
            <p className="text-sm leading-6 text-foreground-secondary">{item.card.examples[0]?.sentence}</p>
            {exampleTranslation ? <p className="text-sm leading-6 text-foreground-muted">{exampleTranslation}</p> : null}
            <Button className="w-full bg-brand hover:bg-brand-hover" onClick={onNext}>
              {t("quiz.nextCard")}
            </Button>
          </div>
        ) : (
          <Button className="mt-4 max-sm:mt-2 w-full" onClick={handleSubmit} disabled={textAnswer.trim().length === 0}>
            {t("quiz.submitAnswer")}
          </Button>
        )}
      </div>
    </div>
    </>
  );
}

function CelebrationView({ card, onContinue }: { card: VocabularyCard; onContinue: () => void }) {
  const t = useT();
  const [cardFace, setCardFace] = useState<"front" | "back">("back");
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    setCardFace("front");
    playSoundEffect("learned");
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

  return (
    <div className="animate-screen-pop mx-auto flex h-full w-full max-w-md flex-col items-center justify-center rounded-lg border border-border bg-background-card p-6 text-center sm:p-10">
      <h2 className="text-2xl font-semibold text-foreground">{t("quiz.learnedTitle")}</h2>

      <div className="mt-6 w-64 max-w-full">
        <VocabularyCardView card={card} owned initialFace="back" face={cardFace} flippable={false} className="w-full aspect-[3/4] min-h-0 h-auto" />
      </div>

      <Button className="mt-8 w-full" onClick={onContinue}>
        {t("quiz.continue")}
      </Button>
    </div>
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
  onRestart,
  onExit,
}: {
  mode: PracticeMode;
  results: QuizResult;
  selectedCount: number | null;
  chestOpened: boolean;
  onRestart: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const [openMenu, setOpenMenu] = useState<"correct" | "incorrect" | "learned" | null>(null);
  const [introPhase, setIntroPhase] = useState<"entering" | "flying" | "done">("entering");
  const introRef = useRef<HTMLDivElement | null>(null);
  const summaryIconRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredResult = useRef(false);
  const performance = getQuizPerformanceSummary(mode, results, selectedCount, chestOpened);
  const SummaryIcon = performance.icon;
  const messageKey = useMemo(
    () => getQuizResultMessageKey(performance.messageKeys, results, selectedCount, chestOpened),
    [chestOpened, performance.messageKeys, results, selectedCount],
  );

  useEffect(() => {
    if (hasTriggeredResult.current) return;
    hasTriggeredResult.current = true;

    playSoundEffect("quiz-complete");
    vibrate("result");
  }, []);

  useEffect(() => {
    if (introPhase !== "entering") return;
    const el = introRef.current;
    if (!el) return;
    let finished = false;

    function onAnimationEnd() {
      if (finished) return;
      finished = true;
      if (performance.level === "high") {
        playSoundEffect("confetti");
        vibrate("confetti");
        void confetti({
          particleCount: 140,
          spread: 110,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#facc15", "#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
          disableForReducedMotion: true,
        });
      }
      setIntroPhase("flying");
    }

    const fallbackTimer = window.setTimeout(onAnimationEnd, 900);
    el.addEventListener("animationend", onAnimationEnd);
    return () => {
      finished = true;
      window.clearTimeout(fallbackTimer);
      el.removeEventListener("animationend", onAnimationEnd);
    };
  }, [introPhase, performance.level]);

  useEffect(() => {
    if (introPhase !== "flying") return;
    const introEl = introRef.current;
    const summaryIconEl = summaryIconRef.current;

    if (!introEl || !summaryIconEl) {
      setIntroPhase("done");
      return;
    }
    let finished = false;

    const first = introEl.getBoundingClientRect();
    const last = summaryIconEl.getBoundingClientRect();
    const translateX = last.left + last.width / 2 - (first.left + first.width / 2);
    const translateY = last.top + last.height / 2 - (first.top + first.height / 2);
    const scale = last.width / first.width;

    introEl.style.transition = "transform 550ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease 350ms";
    introEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    introEl.style.opacity = "0";

    function onTransitionEnd() {
      if (finished) return;
      finished = true;
      setIntroPhase("done");
    }

    const fallbackTimer = window.setTimeout(onTransitionEnd, 700);
    introEl.addEventListener("transitionend", onTransitionEnd);
    return () => {
      finished = true;
      window.clearTimeout(fallbackTimer);
      introEl.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [introPhase]);

  const menuConfig = {
    correct: { title: t("quiz.resultCorrect"), cards: results.correct },
    incorrect: { title: t("quiz.resultIncorrect"), cards: results.incorrect },
    learned: { title: t("quiz.resultLearned"), cards: results.learned },
  } as const;
  const resultCards = [
    {
      key: "correct" as const,
      icon: CheckCircle2,
      label: t("quiz.resultCorrect"),
      count: results.correct.length,
      tone: "emerald" as const,
    },
    {
      key: "incorrect" as const,
      icon: XCircle,
      label: t("quiz.resultIncorrect"),
      count: results.incorrect.length,
      tone: "rose" as const,
    },
    ...(mode === "active"
      ? [{
          key: "learned" as const,
          icon: Trophy,
          label: t("quiz.resultLearned"),
          count: results.learned.length,
          tone: "amber" as const,
        }]
      : []),
  ];

  const menuVisible = introPhase === "done";

  return (
    <div
      data-quiz-result-view
      className="relative mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center overflow-hidden p-2 sm:p-4 max-lg:p-0"
    >
      {introPhase !== "done" ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div
            ref={introRef}
            className={cn(
              "flex size-32 items-center justify-center rounded-full bg-black text-white transition-colors duration-300 dark:bg-white dark:text-black",
              introPhase === "entering" && "animate-trophy-intro-grow",
            )}
          >
            <SummaryIcon className="size-16" aria-hidden="true" />
          </div>
        </div>
      ) : null}

      <div
        data-quiz-result-panel
        className={cn(
          "flex w-full flex-col rounded-xl border border-border bg-background-card p-4 text-center shadow-sm transition-opacity duration-500 sm:rounded-2xl sm:p-10 max-lg:h-full max-lg:justify-center max-lg:rounded-none max-lg:border-0 max-lg:p-5",
          menuVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          ref={summaryIconRef}
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full bg-black text-white transition-opacity duration-300 dark:bg-white dark:text-black sm:size-20",
            menuVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <SummaryIcon className="size-8 sm:size-10" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground sm:mt-5 sm:text-2xl">{t("quiz.resultTitle")}</h2>
        <p className="mt-1 text-4xl font-bold text-foreground sm:mt-2 sm:text-5xl">{performance.accuracy}%</p>
        <p
          className={cn("mt-4 text-xl font-bold leading-tight sm:mt-5 sm:text-2xl", performance.textClassName)}
          data-result-message-level={performance.level}
        >
          {t(messageKey)}
        </p>

        <div
          className={cn(
            "mt-5 grid gap-2 sm:mt-6 sm:gap-3",
            mode === "active" ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2",
          )}
        >
          {resultCards.map((card) => (
            <ResultCard
              key={card.key}
              resultKey={card.key}
              icon={card.icon}
              label={card.label}
              count={card.count}
              tone={card.tone}
              className={card.key === "learned" ? "col-span-2 lg:col-span-1" : undefined}
              disabled={card.count === 0}
              onClick={() => setOpenMenu(card.key)}
            />
          ))}
        </div>

        <div className="mt-4 grid w-full gap-2 sm:mt-6 sm:flex sm:w-auto sm:justify-center sm:gap-3">
          <Button
            className="w-full bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 sm:w-auto"
            onClick={onRestart}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("quiz.restart")}
          </Button>
          <Button className="w-full sm:w-auto" onClick={onExit}>
            <X className="size-4" aria-hidden="true" />
            {t("quiz.exit")}
          </Button>
        </div>
      </div>

      {openMenu ? (
        <ResultMenu
          title={menuConfig[openMenu].title}
          cards={menuConfig[openMenu].cards}
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
  tone,
  className,
  disabled,
  onClick,
}: {
  resultKey: "correct" | "incorrect" | "learned";
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  tone: "emerald" | "rose" | "amber";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const toneClasses = {
    emerald: "bg-emerald-500 text-white",
    rose: "bg-rose-500 text-white",
    amber: "bg-amber-500 text-white",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-result-card={resultKey}
      className={cn(
        "flex min-h-[108px] w-full flex-col items-center justify-center rounded-lg p-3 text-center transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:min-h-[132px] sm:p-4",
        toneClasses[tone],
        className,
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
      )}
    >
      <Icon className="mx-auto size-5 sm:size-6" aria-hidden="true" />
      <p className="mt-1 text-xl font-bold sm:mt-2 sm:text-2xl">{count}</p>
      <p className="text-[11px] font-semibold text-white/90 sm:text-xs">{label}</p>
    </button>
  );
}

export function getQuizPerformanceSummary(
  mode: PracticeMode,
  results: QuizResult,
  selectedCount: number | null,
  chestOpened: boolean,
): QuizPerformanceSummary {
  const totalAnswered = results.correct.length + results.incorrect.length;
  const accuracy = totalAnswered > 0 ? Math.round((results.correct.length / totalAnswered) * 100) : 0;
  const chestTier = mode === "active" && selectedCount ? getChestTierByCount(selectedCount) : undefined;
  const chestUnlocked = accuracy >= 80 && Boolean(chestTier) && !chestOpened;

  if (accuracy >= 80) {
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

  if (accuracy >= 50) {
    return {
      accuracy,
      chestUnlocked: false,
      icon: Medal,
      level: "medium",
      messageKeys: QUIZ_RESULT_MESSAGE_KEYS.medium,
      ringClassName: "border-sky-200 bg-sky-50",
      textClassName: "text-sky-700",
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

function ResultMenu({ title, cards, onClose }: { title: string; cards: VocabularyCard[]; onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="animate-screen-pop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm max-lg:bg-background max-lg:p-0 max-lg:backdrop-blur-none"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-background-card shadow-2xl max-lg:max-h-none max-lg:rounded-none max-lg:border-0"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-3 -translate-y-1/2 bg-black dark:bg-white"
          aria-hidden="true"
        />
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background-card p-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {cards.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground-secondary">No cards</p>
          ) : (
            <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cards.map((card) => (
                <VocabularyCardView key={card.id} card={card} owned={false} className="h-full min-h-[320px] w-full" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
