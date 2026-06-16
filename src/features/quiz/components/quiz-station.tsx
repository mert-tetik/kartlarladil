"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Languages,
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
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [textResult, setTextResult] = useState<"idle" | "correct" | "incorrect">("idle");
  const [results, setResults] = useState<QuizResult>({ correct: [], incorrect: [], learned: [] });
  const [lastLearned, setLastLearned] = useState<VocabularyCard | null>(null);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
            question: { correctAnswer: getCardTranslation(card, getStudyLocale(card.language, locale)) },
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
      setSelectedOption(null);
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

    await requireAuthAction(async () => {
      playSoundEffect(isCorrect ? "correct" : "incorrect");
      const result = await recordAnswer({
        cardId: item.card.id,
        selectedAnswer: answer,
        correctAnswer,
        isCorrect,
        mode,
      });

      const learned = result?.inventoryCard?.status === "learned";

      setResults((current) => ({
        correct: isCorrect ? [...current.correct, item.card] : current.correct,
        incorrect: !isCorrect ? [...current.incorrect, item.card] : current.incorrect,
        learned: learned ? [...current.learned, item.card] : current.learned,
      }));

      if (learned) {
        setLastLearned(item.card);
      }

      setShowingAnswer(true);
      setSelectedOption(answer);
      setTextResult(isCorrect ? "correct" : "incorrect");
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
    setSelectedOption(null);
    setTextAnswer("");
    setTextResult("idle");
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
    setSelectedOption(null);
    setTextAnswer("");
    setTextResult("idle");
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
      <LanguageSelection
        languageStats={languageStats}
        selectedLanguage={selectedLanguage}
        onSelect={handleSelectLanguage}
      />
    );
  }

  if (phase === "count" && selectedLanguage) {
    return (
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
      <ResultView
        results={results}
        onRestart={handleRestart}
        onExit={handleExit}
      />
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
      <div className="mx-auto max-w-5xl">
        <QuizProgressHeader
          item={item}
          currentIndex={currentIndex}
          total={deck.length}
          showingAnswer={showingAnswer}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            {item.questionType === "choice" ? (
              <ChoiceQuestion
                item={item}
                showingAnswer={showingAnswer}
                selectedOption={selectedOption}
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

          <div className="order-1 lg:order-2">
            <div className="mx-auto max-w-xs lg:max-w-none">
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={showingAnswer ? "front" : "back"}
                flippable={false}
                compact
              />
            </div>
          </div>
        </div>
      </div>

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
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Languages className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("quiz.chooseLanguageTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{t("quiz.chooseLanguageDescription")}</p>
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
              "flex cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-white",
              selectedLanguage === language.code && "border-slate-950 bg-white",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
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
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <BookOpen className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("quiz.chooseCountTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
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
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white disabled:opacity-40",
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
}: {
  item: QuizItem;
  currentIndex: number;
  total: number;
  showingAnswer: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const style = TIER_STYLES[item.card.tier];
  const requirement = TIER_REQUIREMENTS[item.card.tier];
  const progress = Math.min(100, (item.inventoryCard.correctCount / requirement) * 100);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge className={cn("border-transparent", style.text)}>
            {item.card.tier} · {item.questionType === "text" ? t("quiz.learningQuizBadge") : t("quiz.activeBadge")}
          </Badge>
          {item.questionType === "text" ? (
            <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {item.questionType === "choice" ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{item.inventoryCard.status === "learned" ? t("cards.learned") : t("cards.progress")}</span>
            <span>
              {item.inventoryCard.correctCount}/{requirement}
            </span>
          </div>
          <Progress value={progress} indicatorClassName={style.accent} />
        </div>
      ) : null}

      {showingAnswer ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
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
  selectedOption,
  onAnswer,
  onNext,
}: {
  item: QuizItem;
  showingAnswer: boolean;
  selectedOption: string | null;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onNext: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const question = item.question as QuizQuestion;
  const answerLocale = getStudyLocale(item.card.language, locale);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <p className="text-sm font-semibold text-slate-500">
        {t("quiz.questionPrompt", { language: getLanguageDisplayName(answerLocale, locale) })}
      </p>
      <h2 className="mt-4 font-display text-5xl font-semibold leading-none text-slate-950 sm:text-6xl">
        {item.card.term}
      </h2>

      <div className="mt-8 grid gap-3">
        {question.options.map((option) => {
          const chosen = selectedOption === option;
          const isCorrectOption = option === question.correctAnswer;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option, isCorrectOption)}
              disabled={showingAnswer}
              className={cn(
                "min-h-14 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-white disabled:cursor-default",
                showingAnswer && isCorrectOption && "border-emerald-500 bg-emerald-50 text-emerald-900",
                showingAnswer && chosen && !isCorrectOption && "border-rose-500 bg-rose-50 text-rose-900",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {showingAnswer ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="w-full" onClick={onNext}>
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
  const answerLocale = getStudyLocale(item.card.language, locale);

  function handleSubmit() {
    if (showingAnswer) return;
    const isCorrect = isAnswerSimilarEnough(textAnswer, question.correctAnswer);
    onSubmit(textAnswer, isCorrect);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-amber-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-amber-700">{t("quiz.learningQuizTitle")}</span>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500">
        {t("quiz.learningQuizPrompt", { language: getLanguageDisplayName(answerLocale, locale) })}
      </p>
      <h2 className="mt-4 font-display text-5xl font-semibold leading-none text-slate-950 sm:text-6xl">
        {item.card.term}
      </h2>

      <div className="mt-8">
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
            "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-950",
            showingAnswer && textResult === "correct" && "border-emerald-500 bg-emerald-50",
            showingAnswer && textResult === "incorrect" && "border-rose-500 bg-rose-50",
          )}
        />

        {showingAnswer ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              {textResult === "correct" ? (
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="size-5 text-rose-600" aria-hidden="true" />
              )}
              <p className="font-semibold text-slate-950">
                {textResult === "correct"
                  ? t("quiz.correctAnswer")
                  : t("quiz.correctAnswerWithValue", { answer: question.correctAnswer })}
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-600">{item.card.examples[0]?.sentence}</p>
            <p className="text-sm leading-6 text-slate-500">
              {getCardExampleTranslation(item.card.examples[0], locale)}
            </p>
            <Button className="w-full" onClick={onNext}>
              {t("quiz.nextCard")}
            </Button>
          </div>
        ) : (
          <Button className="mt-4 w-full" onClick={handleSubmit} disabled={textAnswer.trim().length === 0}>
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
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-10">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Trophy className="size-10" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-950">{t("quiz.learnedTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("quiz.learnedDescription")}</p>

      <div className="mt-6">
        <VocabularyCardView card={card} owned initialFace="front" flippable={false} compact />
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
      <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
        <h2 className="text-center text-2xl font-semibold text-slate-950">{t("quiz.resultTitle")}</h2>

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
      {results.incorrect.length > 0 ? <ResultList title={t("quiz.resultIncorrect")} cards={results.incorrect} /> : null}
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
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {cards.map((card) => (
          <li key={card.id} className="flex items-center justify-between py-2">
            <span className="font-semibold text-slate-800">{card.term}</span>
            <span className="text-sm text-slate-500">{getCardTranslation(card, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
