"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Languages,
  Lock,
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

type QuizPhase = "language" | "count" | "quiz" | "celebration" | "result";

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

export function QuizStation({
  mode,
  onPhaseChange,
}: {
  mode: PracticeMode;
  onPhaseChange?: (phase: QuizPhase) => void;
}) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const recordAnswer = useInventoryStore((state) => state.recordAnswer);
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const requireAuthAction = useRequireAuthAction();

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [desktopCardFace, setDesktopCardFace] = useState<"front" | "back">("back");
  const [mobileCardOpen, setMobileCardOpen] = useState(false);
  const [mobileCardFace, setMobileCardFace] = useState<"front" | "back">("back");

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((language) => ({
        ...language,
        count: filterInventoryCards({ cards, language: language.code, status: mode }).length,
      })).filter((language) => language.count > 0),
    [cards, mode],
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

        if (willLearn) {
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
      setPhase("quiz");
    },
    [cards, mode, locale],
  );

  function handleSelectLanguage(language: LanguageCode) {
    setSelectedLanguage(language);
    const count = filterInventoryCards({ cards, language, status: mode }).length;

    if (count < 10) {
      buildDeck(language, null);
      return;
    }

    setSelectedCount(null);
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

    if (item.willLearn) {
      const effectivePlan = entitlements?.effectivePlan ?? "free";
      const learnedLimit = PLAN_LIMITS[effectivePlan].learnedCards;

      if (effectivePlan === "free" && typeof learnedLimit === "number") {
        const learnedCount = cards.filter((card) => card.status === "learned").length;

        if (learnedCount >= learnedLimit) {
          setLimitError("free_learned_card_limit");
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
      nextPath: "/learn",
    });
  }

  function handleNext() {
    if (lastLearned) {
      setPhase("celebration");
      return;
    }

    if (currentIndex + 1 >= deck.length) {
      setPhase("result");
      return;
    }

    setCurrentIndex((current) => current + 1);
    setShowingAnswer(false);
    setTextAnswer("");
    setTextResult("idle");
    setLastAnswerCorrect(null);
    setDesktopCardFace("back");
    setMobileCardFace("back");
    setMobileCardOpen(false);
  }

  function handleContinueFromCelebration() {
    const learned = lastLearned;
    setLastLearned(null);

    if (currentIndex + 1 >= deck.length) {
      if (learned) {
        setResults((current) => ({
          ...current,
          learned: [...current.learned, learned],
        }));
      }
      setPhase("result");
      return;
    }

    setCurrentIndex((current) => current + 1);
    setShowingAnswer(false);
    setTextAnswer("");
    setTextResult("idle");
    setLastAnswerCorrect(null);
    setDesktopCardFace("back");
    setMobileCardFace("back");
    setMobileCardOpen(false);
  }

  function handleRestart() {
    if (selectedLanguage) {
      const count = filterInventoryCards({ cards, language: selectedLanguage, status: mode }).length;

      if (count < 10) {
        buildDeck(selectedLanguage, null);
        return;
      }
    }

    setPhase("count");
  }

  function handleExit() {
    router.push("/my-cards");
  }

  if (!hydrated) {
    return <EmptyState title={t("quiz.loadingTitle")} description={t("quiz.loadingDescription")} />;
  }

  if (languageStats.length === 0) {
    return (
      <EmptyState
        title={t("inventory.emptyAnyTitle")}
        description={t("inventory.emptyAnyDescription")}
        action={
          <Button onClick={() => router.push("/card-draw")}>{t("quiz.backToDraw")}</Button>
        }
      />
    );
  }

  if (phase === "language") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <LanguageSelection
          languageStats={languageStats}
          selectedLanguage={selectedLanguage}
          onSelect={handleSelectLanguage}
        />
      </div>
    );
  }

  if (phase === "count" && selectedLanguage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <CountSelection
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
      <div
        data-learn-quiz-page="result"
        className="animate-screen-pop fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center bg-background p-4"
      >
        <div className="w-full max-w-3xl">
          <ResultView
            results={results}
            onRestart={handleRestart}
            onExit={handleExit}
          />
        </div>
      </div>
    );
  }

  const item = deck[currentIndex];

  if (!item) {
    return (
      <EmptyState
        title={t("quiz.noActiveTitle")}
        description={t("quiz.noActiveDescription")}
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
      <div className="animate-screen-pop mx-auto flex h-full w-full max-w-5xl flex-col justify-center" data-learn-quiz-page="quiz">
        <div className="grid gap-6 max-sm:gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="order-2 flex flex-col justify-center gap-4 lg:order-1">
            <QuizCounter currentIndex={currentIndex} total={deck.length} showingAnswer={showingAnswer} />
            <QuizProgressHeader
              item={item}
              showingAnswer={showingAnswer}
              lastAnswerCorrect={lastAnswerCorrect}
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
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDesktopCardFace((current) => (current === "front" ? "back" : "front"))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDesktopCardFace((current) => (current === "front" ? "back" : "front"));
                }
              }}
              className="h-[440px] w-auto cursor-pointer focus:outline-none"
              aria-label={t("cards.flip")}
            >
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
          <div className="relative w-full max-w-xs" onClick={(event) => event.stopPropagation()}>
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
                className="w-full"
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

function LanguageSelection({
  languageStats,
  selectedLanguage,
  onSelect,
}: {
  languageStats: Array<{ code: LanguageCode; count: number; nativeName: string }>;
  selectedLanguage: LanguageCode | null;
  onSelect: (language: LanguageCode) => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <div className="animate-screen-pop mx-auto max-w-3xl rounded-lg border border-border bg-background-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <Languages className="size-6 shrink-0 text-foreground-secondary" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("quiz.chooseLanguageTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-secondary">{t("quiz.chooseLanguageDescription")}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="h-[320px] overflow-y-auto rounded-md border border-border bg-background p-2 max-sm:h-[280px]">
          <div className="grid grid-cols-1 gap-2">
            {languageStats.map((language) => (
              <button
                key={language.code}
                type="button"
                aria-pressed={selectedLanguage === language.code}
                onClick={() => onSelect(language.code)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md border border-border bg-background-card p-3 text-left transition-colors hover:bg-background-muted",
                  selectedLanguage === language.code && "border-foreground bg-background-muted",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                  <LanguageFlag code={language.code} />
                  <span className="truncate">{getLanguageDisplayName(language.code, locale)}</span>
                </span>
                <Badge>{formatCards(locale, language.count)}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountSelection({
  language,
  availableCount,
  selectedCount,
  onSelect,
  onBack,
}: {
  language: LanguageCode;
  availableCount: number;
  selectedCount: number | null;
  onSelect: (count: number) => void;
  onBack: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <div className="animate-screen-pop mx-auto max-w-3xl rounded-lg border border-border bg-background-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <BookOpen className="size-6 shrink-0 text-foreground-secondary" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("quiz.chooseCountTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-secondary">
            {t("quiz.chooseCountDescription", {
              language: getLanguageDisplayName(language, locale),
              count: availableCount,
            })}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {COUNT_OPTIONS.map((count) => {
          const disabled = count > availableCount;

          return (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(count)}
              className={cn(
                "rounded-md border px-3 py-3 text-sm font-semibold transition-colors",
                selectedCount === count
                  ? "border-foreground bg-background-inverse text-foreground-inverse"
                  : "border-border bg-background text-foreground-secondary hover:bg-background-card disabled:opacity-40",
              )}
            >
              {count}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {t("common.back")}
        </Button>
      </div>
    </div>
  );
}

function QuizProgressHeader({
  item,
  showingAnswer,
  lastAnswerCorrect,
  onShowCard,
}: {
  item: QuizItem;
  showingAnswer: boolean;
  lastAnswerCorrect: boolean | null;
  onShowCard: () => void;
}) {
  const t = useT();
  const style = TIER_STYLES[item.card.tier];
  const requirement = TIER_REQUIREMENTS[item.card.tier];
  const delta = showingAnswer && lastAnswerCorrect !== null ? (lastAnswerCorrect ? 1 : -1) : 0;
  const displayCorrectCount = Math.max(0, Math.min(requirement, item.inventoryCard.correctCount + delta));
  const progress = Math.min(100, (displayCorrectCount / requirement) * 100);

  return (
    <div className="rounded-lg border border-border bg-background-card p-3 max-sm:p-2 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {item.questionType === "text"
            ? t("quiz.learningQuizBadge")
            : t("quiz.activeBadgeWithTier", { tier: item.card.tier })}
        </Badge>
        <button
          type="button"
          onClick={onShowCard}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold text-foreground-inverse transition-colors hover:brightness-110 active:brightness-90 lg:hidden",
            style.accent,
          )}
        >
          {t("quiz.showCard")}
        </button>
      </div>

      {item.questionType === "choice" ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground-secondary">
            <span>{item.inventoryCard.status === "learned" ? t("cards.learned") : t("quiz.cardLearningProcess")}</span>
            <span>
              {displayCorrectCount}/{requirement}
            </span>
          </div>
          <Progress value={progress} indicatorClassName={style.accent} />
        </div>
      ) : null}

    </div>
  );
}

function QuizCounter({
  currentIndex,
  total,
  showingAnswer,
}: {
  currentIndex: number;
  total: number;
  showingAnswer: boolean;
}) {
  const progress = Math.min(100, ((currentIndex + (showingAnswer ? 1 : 0)) / total) * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xl font-bold text-foreground max-lg:hidden">
        {currentIndex + 1} / {total}
      </span>
      <div className="w-full max-w-xs">
        <Progress value={progress} indicatorClassName="bg-rose-500" />
      </div>
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
    <div className="animate-screen-pop flex flex-col gap-4 rounded-lg border border-border bg-background-card p-4 max-sm:p-3 sm:p-8">
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

  function handleSubmit() {
    if (showingAnswer) return;
    const isCorrect = isAnswerSimilarEnough(textAnswer, question.correctAnswer);
    onSubmit(textAnswer, isCorrect);
  }

  return (
    <div className="animate-screen-pop flex flex-col gap-4 rounded-lg border border-border bg-background-card p-4 max-sm:p-3 sm:p-8">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-amber-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
      </div>

      <p className="text-sm font-semibold text-foreground-muted">
        {t("quiz.learningQuizPrompt", { language: getLanguageDisplayName(item.card.language, locale) })}
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
            <p className="text-sm leading-6 text-foreground-muted">
              {getCardExampleTranslation(item.card.examples[0], locale)}
            </p>
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
  );
}

function CelebrationView({ card, onContinue }: { card: VocabularyCard; onContinue: () => void }) {
  const t = useT();
  const [cardFace, setCardFace] = useState<"front" | "back">("back");
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    playSoundEffect("learned");
    vibrate("learned");

    const flipTimer = setTimeout(() => {
      setCardFace("front");
    }, 1500);

    const confettiTimer = setTimeout(() => {
      playSoundEffect("confetti");
      vibrate("confetti");
      void confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"],
        disableForReducedMotion: true,
      });
    }, 1750);

    return () => {
      clearTimeout(flipTimer);
      clearTimeout(confettiTimer);
    };
  }, []);

  return (
    <div className="animate-screen-pop mx-auto flex h-full w-full max-w-md flex-col items-center justify-center rounded-lg border border-border bg-background-card p-6 text-center sm:p-10">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Trophy className="size-10" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-foreground">{t("quiz.learnedTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-secondary">{t("quiz.learnedDescription")}</p>

      <div className="mt-6 h-[280px] w-auto max-sm:h-[240px]">
        <VocabularyCardView card={card} owned initialFace="back" face={cardFace} flippable={false} className="h-full w-auto" />
      </div>

      <Button className="mt-8 w-full" onClick={onContinue}>
        {t("quiz.continue")}
      </Button>
    </div>
  );
}

function ResultView({
  results,
  onRestart,
  onExit,
}: {
  results: QuizResult;
  onRestart: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const [openMenu, setOpenMenu] = useState<"correct" | "incorrect" | "learned" | null>(null);
  const hasTriggeredResult = useRef(false);

  useEffect(() => {
    if (hasTriggeredResult.current) return;
    hasTriggeredResult.current = true;

    playSoundEffect("quiz-complete");
    vibrate("result");
  }, []);
  const total = results.correct.length + results.incorrect.length + results.learned.length;
  const accuracy = total > 0 ? Math.round(((results.correct.length + results.learned.length) / total) * 100) : 0;

  const menuConfig = {
    correct: { title: t("quiz.resultCorrect"), cards: results.correct },
    incorrect: { title: t("quiz.resultIncorrect"), cards: results.incorrect },
    learned: { title: t("quiz.resultLearned"), cards: results.learned },
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center overflow-hidden p-4">
      <div className="w-full rounded-2xl border border-border bg-background-card p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Trophy className="size-10" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">{t("quiz.resultTitle")}</h2>
        <p className="mt-2 text-5xl font-bold text-foreground">{accuracy}%</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ResultCard
            icon={CheckCircle2}
            label={t("quiz.resultCorrect")}
            count={results.correct.length}
            tone="emerald"
            disabled={results.correct.length === 0}
            onClick={() => setOpenMenu("correct")}
          />
          <ResultCard
            icon={XCircle}
            label={t("quiz.resultIncorrect")}
            count={results.incorrect.length}
            tone="rose"
            disabled={results.incorrect.length === 0}
            onClick={() => setOpenMenu("incorrect")}
          />
          <ResultCard
            icon={Trophy}
            label={t("quiz.resultLearned")}
            count={results.learned.length}
            tone="amber"
            disabled={results.learned.length === 0}
            onClick={() => setOpenMenu("learned")}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("quiz.restart")}
          </Button>
          <Button onClick={onExit}>
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
  icon: Icon,
  label,
  count,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  tone: "emerald" | "rose" | "amber";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg p-4 text-center transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        toneClasses[tone],
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
      )}
    >
      <Icon className="mx-auto size-6" aria-hidden="true" />
      <p className="mt-2 text-2xl font-bold">{count}</p>
      <p className="text-xs font-semibold opacity-80">{label}</p>
    </button>
  );
}

function ResultMenu({ title, cards, onClose }: { title: string; cards: VocabularyCard[]; onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="animate-screen-pop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-background-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-background-card p-4">
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
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
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
