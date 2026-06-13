"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Info, Trophy, XCircle } from "lucide-react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LANGUAGES } from "@/data/languages";
import { TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { getCardExampleTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { buildQuizQuestion } from "@/features/quiz/quiz-engine";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { Progress } from "@/components/ui/progress";
import { formatCards, getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import type { LanguageCode, LimitErrorCode, PracticeMode, QuizQuestion } from "@/types/domain";

export function QuizStation({ mode }: { mode: PracticeMode }) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const recordAnswer = useInventoryStore((state) => state.recordAnswer);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const requireAuthAction = useRequireAuthAction();
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
  const t = useT();

  const baseAvailableCards = useMemo(
    () =>
      filterInventoryCards({
        cards,
        status: mode === "active" ? "active" : "learned",
      }),
    [cards, mode],
  );
  const languageStats = useMemo(
    () =>
      LANGUAGES.map((language) => ({
        ...language,
        count: baseAvailableCards.filter((item) => item.card.language === language.code).length,
      })).filter((language) => language.count > 0),
    [baseAvailableCards],
  );
  const activeLanguage = selectedLanguage && languageStats.some((language) => language.code === selectedLanguage)
    ? selectedLanguage
    : languageStats[0]?.code ?? null;
  const availableCards = useMemo(
    () =>
      activeLanguage
        ? baseAvailableCards.filter((item) => item.card.language === activeLanguage)
        : [],
    [activeLanguage, baseAvailableCards],
  );

  function startNextQuestion() {
    if (mode === "active" && wouldExceedLearnedLimit()) {
      setLimitError("free_learned_card_limit");
      setQuestion(null);
      return;
    }

    if (availableCards.length === 0) {
      setQuestion(null);
      return;
    }

    const nextIndex = Math.floor(Math.random() * availableCards.length);
    setQuestion(buildQuizQuestion(availableCards[nextIndex].card, VOCABULARY_CARDS, locale));
    setSelectedAnswer(null);
    setAnswered(false);
    setSubmitting(false);
    setDetailsOpen(false);
  }

  function startNextQuestionWithAuth() {
    requireAuthAction(startNextQuestion, {
      nextPath: mode === "active" ? "/learn" : "/learned",
    });
  }

  function wouldExceedLearnedLimit(): boolean {
    const learnedLimit = entitlements?.limits.learnedCards;

    if (entitlements?.effectivePlan !== "free" || learnedLimit === null) {
      return false;
    }

    const learnedCount = cards.filter((card) => card.status === "learned").length;
    return learnedCount >= learnedLimit;
  }

  if (!hydrated) {
    return <EmptyState icon={BookOpen} title={t("quiz.loadingTitle")} description={t("quiz.loadingDescription")} />;
  }

  if (!question) {
    if (availableCards.length > 0) {
      if (languageStats.length > 1) {
        return (
          <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <BookOpen className="size-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t("quiz.chooseLanguageTitle")}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  {t("quiz.chooseLanguageDescription")}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {languageStats.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  aria-pressed={activeLanguage === language.code}
                  onClick={() => {
                    setSelectedLanguage(language.code);
                    setQuestion(null);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-white",
                    activeLanguage === language.code && "border-slate-950 bg-white",
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

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-500">
                {activeLanguage
                  ? t("quiz.selectedLanguage", { language: getLanguageDisplayName(activeLanguage, locale) })
                  : t("quiz.selectedLanguageEmpty")}
              </p>
              <Button onClick={startNextQuestionWithAuth} disabled={!activeLanguage}>
                {t("quiz.start")}
              </Button>
            </div>
          </div>
        );
      }

      return (
        <EmptyState
          icon={BookOpen}
          title={t("quiz.readyTitle")}
          description={t("quiz.readyDescription", { count: availableCards.length })}
          action={<Button onClick={startNextQuestionWithAuth}>{t("quiz.start")}</Button>}
        />
      );
    }

    return (
      <EmptyState
        icon={mode === "active" ? BookOpen : Trophy}
        title={
          cards.length === 0
            ? t("inventory.emptyAnyTitle")
            : mode === "active"
              ? t("quiz.noActiveTitle")
              : t("quiz.noLearnedTitle")
        }
        description={
          cards.length === 0
            ? t("inventory.emptyAnyDescription")
            : mode === "active"
              ? t("quiz.noActiveDescription")
              : t("quiz.noLearnedDescription")
        }
        action={
          <Link href={mode === "active" ? "/card-draw" : "/learn"} className={buttonClassName("primary", "md")}>
            {mode === "active" ? t("quiz.backToDraw") : t("quiz.backToLearn")}
          </Link>
        }
      />
    );
  }

  const currentQuestion = question;
  const answerLocale = getStudyLocale(currentQuestion.card.language, locale);
  const inventoryCard = cards.find((card) => card.cardId === currentQuestion.card.id);
  const style = TIER_STYLES[currentQuestion.card.tier];
  const requirement = TIER_REQUIREMENTS[currentQuestion.card.tier];
  const progress = inventoryCard ? Math.min(100, (inventoryCard.correctCount / requirement) * 100) : 0;
  const correct = selectedAnswer === currentQuestion.correctAnswer;

  function submit(answer: string) {
    if (answered || submitting) {
      return;
    }

    const willLearn =
      mode === "active" &&
      inventoryCard?.status !== "learned" &&
      answer === currentQuestion.correctAnswer &&
      (inventoryCard?.correctCount ?? 0) + 1 >= requirement;

    if (willLearn && wouldExceedLearnedLimit()) {
      setLimitError("free_learned_card_limit");
      return;
    }

    void requireAuthAction(async () => {
      const isCorrect = answer === currentQuestion.correctAnswer;

      setSubmitting(true);
      playSoundEffect(isCorrect ? "correct" : "incorrect");
      await recordAnswer({
        cardId: currentQuestion.card.id,
        selectedAnswer: answer,
        correctAnswer: currentQuestion.correctAnswer,
        isCorrect,
        mode,
      });
      setSelectedAnswer(answer);
      setAnswered(true);
      setSubmitting(false);
    }, {
      nextPath: mode === "active" ? "/learn" : "/learned",
    });
  }

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {currentQuestion.card.tier} · {mode === "active" ? t("quiz.activeBadge") : t("quiz.reviewBadge")}
        </Badge>
        {inventoryCard ? (
          <span className="text-sm font-semibold text-slate-500">
            {t("quiz.correctCounter", { count: inventoryCard.correctCount, required: requirement })}
          </span>
        ) : null}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm font-semibold text-slate-500">
          {t("quiz.questionPrompt", { language: getLanguageDisplayName(answerLocale, locale) })}
        </p>
        <h2 className="mt-4 font-display text-6xl font-semibold leading-none text-slate-950">{currentQuestion.card.term}</h2>
        <p className="mt-3 text-sm text-slate-500">{currentQuestion.card.pronunciation}</p>
      </div>

      {mode === "active" && inventoryCard ? (
        <div className="mt-8">
          <Progress value={progress} indicatorClassName={style.accent} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {currentQuestion.options.map((option) => {
          const chosen = selectedAnswer === option;
          const isCorrectOption = option === currentQuestion.correctAnswer;

          return (
            <button
              key={option}
              type="button"
              onClick={() => submit(option)}
              disabled={answered || submitting}
              className={cn(
                "min-h-14 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-white disabled:cursor-default",
                answered && isCorrectOption && "border-emerald-500 bg-emerald-50 text-emerald-900",
                answered && chosen && !isCorrectOption && "border-rose-500 bg-rose-50 text-rose-900",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            {correct ? (
              <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
            ) : (
              <XCircle className="size-5 text-rose-600" aria-hidden="true" />
            )}
            <p className="font-semibold text-slate-950">
              {correct ? t("quiz.correctAnswer") : t("quiz.correctAnswerWithValue", { answer: currentQuestion.correctAnswer })}
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{currentQuestion.card.examples[0].sentence}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {getCardExampleTranslation(currentQuestion.card.examples[0], locale)}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setDetailsOpen(true)}>
              <Info className="size-4" aria-hidden="true" />
              {t("quiz.showDetails")}
            </Button>
            <Button className="w-full sm:w-auto" onClick={startNextQuestion}>
              {t("quiz.nextCard")}
            </Button>
          </div>
        </div>
      ) : null}

      <CardDetailsDialog card={currentQuestion.card} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <UpgradeDialog
        open={limitError !== null}
        errorCode={limitError}
        onOpenChange={(open) => {
          if (!open) {
            setLimitError(null);
          }
        }}
      />
    </div>
  );
}
