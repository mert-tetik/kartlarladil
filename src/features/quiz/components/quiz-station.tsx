"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Info, Trophy, XCircle } from "lucide-react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { getCardExampleTranslation } from "@/features/cards/card-localization";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { buildQuizQuestion } from "@/features/quiz/quiz-engine";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { useLocale } from "@/i18n/locale-provider";
import type { PracticeMode, QuizQuestion } from "@/types/domain";

export function QuizStation({ mode }: { mode: PracticeMode }) {
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const recordAnswer = useInventoryStore((state) => state.recordAnswer);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const requireAuthAction = useRequireAuthAction();
  const { locale } = useLocale();

  const availableCards = useMemo(
    () =>
      filterInventoryCards({
        cards,
        status: mode === "active" ? "active" : "learned",
      }),
    [cards, mode],
  );

  function startNextQuestion() {
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
      nextPath: mode === "active" ? "/ogren" : "/ogrenilenler",
    });
  }

  if (!hydrated) {
    return <EmptyState icon={BookOpen} title="Alıştırma hazırlanıyor" description="Kart haznen okunuyor." />;
  }

  if (!question) {
    if (availableCards.length > 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="Alıştırma hazır"
          description={`${availableCards.length} kartla çalışabilirsin. Sorular çoktan seçmeli olarak hazırlanır.`}
          action={<Button onClick={startNextQuestionWithAuth}>Alıştırmayı başlat</Button>}
        />
      );
    }

    return (
      <EmptyState
        icon={mode === "active" ? BookOpen : Trophy}
        title={mode === "active" ? "Öğrenilecek kart yok" : "Öğrenilmiş kart yok"}
        description={
          mode === "active"
            ? "Önce Kart çek ekranından kartları haznene ekle."
            : "Aktif kartları quiz ile tamamladığında burada tekrar yapabilirsin."
        }
        action={
          <Link href={mode === "active" ? "/kart-cek" : "/ogren"} className={buttonClassName("primary", "md")}>
            {mode === "active" ? "Kart çek" : "Öğrenmeye dön"}
          </Link>
        }
      />
    );
  }

  const currentQuestion = question;
  const inventoryCard = cards.find((card) => card.cardId === currentQuestion.card.id);
  const style = TIER_STYLES[currentQuestion.card.tier];
  const requirement = TIER_REQUIREMENTS[currentQuestion.card.tier];
  const progress = inventoryCard ? Math.min(100, (inventoryCard.correctCount / requirement) * 100) : 0;
  const correct = selectedAnswer === currentQuestion.correctAnswer;

  function submit(answer: string) {
    if (answered || submitting) {
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
      nextPath: mode === "active" ? "/ogren" : "/ogrenilenler",
    });
  }

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={cn("border-transparent", style.text)}>
          {currentQuestion.card.tier} · {mode === "active" ? "Öğreniliyor" : "Tekrar"}
        </Badge>
        {inventoryCard ? (
          <span className="text-sm font-semibold text-slate-500">
            {inventoryCard.correctCount}/{requirement} doğru
          </span>
        ) : null}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm font-semibold text-slate-500">Türkçe karşılığı nedir?</p>
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
              {correct ? "Doğru cevap" : `Doğru cevap: ${currentQuestion.correctAnswer}`}
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{currentQuestion.card.examples[0].sentence}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {getCardExampleTranslation(currentQuestion.card.examples[0], locale)}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setDetailsOpen(true)}>
              <Info className="size-4" aria-hidden="true" />
              Detayları gör
            </Button>
            <Button className="w-full sm:w-auto" onClick={startNextQuestion}>
              Sonraki kart
            </Button>
          </div>
        </div>
      ) : null}

      <CardDetailsDialog card={currentQuestion.card} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}
