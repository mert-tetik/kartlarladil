"use client";

import { useCallback, useMemo, useState } from "react";
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
import type {
  InventoryCard,
  LanguageCode,
  LimitErrorCode,
  PracticeMode,
  QuizQuestion,
  VocabularyCard,
} from "@/types/domain";

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

export function QuizStation({ mode }: { mode: PracticeMode }) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const recordAnswer = useInventoryStore((state) => state.recordAnswer);
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const requireAuthAction = useRequireAuthAction();

  const [phase, setPhase] = useState<"language" | "count" | "quiz" | "celebration" | "result">("language");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [deck, setDeck] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [textAnswer, setTextAnswer] = useState("");
  const [textResult, setTextResult] = useState<"idle" | "correct" | "incorrect">("idle");
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
    return <EmptyState icon={BookOpen} title={t("quiz.loadingTitle")} description={t("quiz.loadingDescription")} />;
  }

  if (languageStats.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
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
        className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center bg-background p-4"
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
        icon={BookOpen}
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
      <div className="mx-auto max-w-5xl" data-learn-quiz-page={phase === "quiz" ? "quiz" : undefined}>
        <QuizProgressHeader
          item={item}
          currentIndex={currentIndex}
          total={deck.length}
          showingAnswer={showingAnswer}
          onShowCard={() => {
            setMobileCardOpen(true);
            setMobileCardFace(showingAnswer ? "front" : "back");
          }}
        />

        <div className="mt-6 max-sm:mt-3 grid gap-6 max-sm:gap-3 lg:grid-cols-2">
          <div className="order-2 flex flex-col lg:order-1">
            {item.questionType === "choice" ? (
              <ChoiceQuestion
                item={item}
                showingAnswer={showingAnswer}
                onAnswer={handleAnswer}
                onNext={handleNext}
              />
            ) : (
              <TextQuestion
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

          <div className="order-1 hidden h-full min-h-0 items-center justify-center lg:order-2 lg:flex">
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
              className="h-full w-auto cursor-pointer focus:outline-none"
              aria-label={t("cards.flip")}
            >
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={desktopCardFace}
                flippable={false}
                className="h-full w-auto max-w-full !min-h-0"
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
    <div className="mx-auto max-w-3xl rounded-lg border border-border bg-background-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-background-muted text-foreground-secondary">
          <Languages className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("quiz.chooseLanguageTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-secondary">{t("quiz.chooseLanguageDescription")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {languageStats.map((language) => (
          <button
            key={language.code}
            type="button"
            aria-pressed={selectedLanguage === language.code}
            onClick={() => onSelect(language.code)}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-background-card",
              selectedLanguage === language.code && "border-foreground bg-background-card",
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
    <div className="mx-auto max-w-3xl rounded-lg border border-border bg-background-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-background-muted text-foreground-secondary">
          <BookOpen className="size-6" aria-hidden="true" />
        </div>
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
  currentIndex,
  total,
  showingAnswer,
  onShowCard,
}: {
  item: QuizItem;
  currentIndex: number;
  total: number;
  showingAnswer: boolean;
  onShowCard: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const style = TIER_STYLES[item.card.tier];
  const requirement = TIER_REQUIREMENTS[item.card.tier];
  const progress = Math.min(100, (item.inventoryCard.correctCount / requirement) * 100);

  return (
    <div className="rounded-lg border border-border bg-background-card p-3 max-sm:p-2 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
          {item.questionType === "text" ? (
            <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-foreground-muted">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {item.questionType === "choice" ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground-secondary">
            <span>{item.inventoryCard.status === "learned" ? t("cards.learned") : t("cards.progress")}</span>
            <span>
              {item.inventoryCard.correctCount}/{requirement}
            </span>
          </div>
          <Progress value={progress} indicatorClassName={style.accent} />
        </div>
      ) : null}

      {showingAnswer ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground-muted">
          <Volume2 className="size-4" aria-hidden="true" />
          <span>{item.card.pronunciation}</span>
        </div>
      ) : null}
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
    <div className="rounded-lg border border-border bg-background-card p-4 max-sm:p-3 sm:p-8">
      <p className="text-sm font-semibold text-foreground-muted">
        {t("quiz.questionPrompt", { language: getLanguageDisplayName(answerLocale, locale) })}
      </p>
      <h2 className="mt-4 max-sm:mt-2 font-display text-5xl font-semibold leading-none text-foreground sm:text-6xl">
        {item.card.term}
      </h2>

      <div className="mt-8 max-sm:mt-4 grid gap-3">
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
    <div className="rounded-lg border border-border bg-background-card p-4 max-sm:p-3 sm:p-8">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-amber-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
      </div>

      <p className="mt-4 max-sm:mt-2 text-sm font-semibold text-foreground-muted">
        {t("quiz.learningQuizPrompt", { language: getLanguageDisplayName(item.card.language, locale) })}
      </p>
      <h2 className="mt-4 max-sm:mt-2 font-display text-5xl font-semibold leading-none text-foreground sm:text-6xl">
        {getCardTranslation(item.card, locale)}
      </h2>

      <div className="mt-8 max-sm:mt-4">
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
  const { locale } = useLocale();
  const t = useT();

  return (
    <div className="mx-auto max-w-md rounded-lg border border-border bg-background-card p-6 text-center sm:p-10">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Trophy className="size-10" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-foreground">{t("quiz.learnedTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-secondary">{t("quiz.learnedDescription")}</p>

      <div className="mt-6">
        <VocabularyCardView card={card} owned initialFace="front" flippable={false} />
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border border-border bg-background-card p-5 sm:p-8">
        <h2 className="text-center text-2xl font-semibold text-foreground">{t("quiz.resultTitle")}</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ResultCard
            icon={CheckCircle2}
            label={t("quiz.resultCorrect")}
            count={results.correct.length}
            tone="emerald"
          />
          <ResultCard
            icon={XCircle}
            label={t("quiz.resultIncorrect")}
            count={results.incorrect.length}
            tone="rose"
          />
          <ResultCard
            icon={Trophy}
            label={t("quiz.resultLearned")}
            count={results.learned.length}
            tone="amber"
          />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
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

      {results.learned.length > 0 ? <ResultList title={t("quiz.resultLearned")} cards={results.learned} /> : null}
      {results.correct.length > 0 ? <ResultList title={t("quiz.resultCorrect")} cards={results.correct} /> : null}
    </div>
  );
}

function ResultCard({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  tone: "emerald" | "rose" | "amber";
}) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={cn("rounded-lg p-4 text-center", toneClasses[tone])}>
      <Icon className="mx-auto size-6" aria-hidden="true" />
      <p className="mt-2 text-2xl font-bold">{count}</p>
      <p className="text-xs font-semibold opacity-80">{label}</p>
    </div>
  );
}

function ResultList({ title, cards }: { title: string; cards: VocabularyCard[] }) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <div className="rounded-lg border border-border bg-background-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 divide-y divide-border">
        {cards.map((card) => (
          <li key={card.id} className="flex items-center justify-between py-2">
            <span className="font-semibold text-foreground">{card.term}</span>
            <span className="text-sm text-foreground-muted">{getCardTranslation(card, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
