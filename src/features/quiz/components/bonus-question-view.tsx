"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleHelp, Loader2, XCircle } from "lucide-react";
import {
  getBonusCopy,
  type BonusQuestion,
  type CategorySortBonusQuestion,
  type ImposterBonusQuestion,
  type MatchingBonusQuestion,
  type SentenceOrderBonusQuestion,
} from "@/features/quiz/bonus-questions";
import { BONUS_QUESTION_POINTS } from "@/features/quiz/bonus-question-constants";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { ScoreIcon } from "@/components/score-icon";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { QuizSkipButton } from "@/features/quiz/components/quiz-skip-button";

export function BonusQuestionIntro({ onComplete }: { onComplete: () => void }) {
  const { locale } = useLocale();
  const copy = getBonusCopy(locale);
  const [exiting, setExiting] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setExiting(true), 1_050);
    const exitTimer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, 1_460);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [onComplete]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[var(--brand)] text-[var(--brand-foreground)]",
        exiting ? "animate-bonus-intro-exit" : "animate-bonus-intro-enter",
      )}
      data-bonus-question-intro
      aria-hidden="true"
    >
      <span
        className={cn(
          "px-6 text-center text-4xl font-bold sm:text-6xl",
          exiting ? "animate-bonus-intro-copy-exit" : "animate-bonus-intro-copy",
          canUseSuperWater(locale) && "font-super-water",
        )}
      >
        {formatSuperWaterText(locale, copy.intro)}
      </span>
    </div>,
    document.body,
  );
}

export function BonusQuestionView({
  question,
  showingAnswer,
  answerAccepted,
  canAdvance = true,
  onSubmit,
  onSkip,
  onNext,
  onFlightStart,
  onPointArrive,
  onFlightComplete,
}: {
  question: BonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  canAdvance?: boolean;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  onNext: () => void;
  onFlightStart?: () => void;
  onPointArrive?: (points: number) => void;
  onFlightComplete?: () => void;
}) {
  const { locale, t } = useLocale();
  const copy = getBonusCopy(locale);
  const sourceRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className="animate-screen-pop flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl bg-transparent px-1 py-2 text-foreground sm:gap-5 sm:px-4"
      data-bonus-question={question.kind}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
          <CircleHelp className="size-4" aria-hidden="true" />
          {formatSuperWaterText(locale, copy.bonusPoints)}
        </span>
        <h2
          className={cn(
            "text-2xl font-semibold text-foreground sm:text-3xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterText(locale, getBonusTitle(copy, question.kind))}
        </h2>
        <p className="text-sm font-medium text-foreground-muted">
          {getBonusPrompt(copy, question.kind)}
        </p>
      </div>

      <div ref={sourceRef} className="flex w-full flex-col items-center">
        {question.kind === "matching" ? (
          <MatchingBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "sentence-order" ? (
          <SentenceOrderBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "category-sort" ? (
          <CategorySortBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : (
          <ImposterBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        {!showingAnswer ? null : (
          <div className={cn("flex items-center gap-2 text-sm font-semibold", answerAccepted ? "text-emerald-500" : "text-rose-500")}>
            {answerAccepted ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <XCircle className="size-5" aria-hidden="true" />}
            {answerAccepted ? copy.correct : copy.incorrect}
          </div>
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={!showingAnswer || !canAdvance}
          className={cn(
            "w-full max-w-sm bg-brand text-brand-foreground hover:bg-brand-hover max-lg:hidden",
            !showingAnswer && "invisible pointer-events-none",
          )}
          data-bonus-next
        >
          {canAdvance ? t("quiz.nextCard") : <Loader2 className="size-5 animate-spin" aria-label={t("quiz.aiValidating")} />}
        </Button>
      </div>

      {showingAnswer && answerAccepted
        ? <BonusPointFlight
            sourceRef={sourceRef}
            onFlightStart={onFlightStart}
            onPointArrive={onPointArrive}
            onComplete={onFlightComplete}
          />
        : null}
    </div>
  );
}

function MatchingBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: MatchingBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const matchedMeaningIds = new Set(Object.values(matches));
  const canCheck = Object.keys(matches).length === question.pairs.length;
  const isCorrect = question.pairs.every((pair) => matches[pair.id] === pair.id);

  function selectTerm(id: string) {
    if (showingAnswer) return;
    if (matches[id]) {
      setMatches((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    setSelectedTermId(id);
  }

  function selectMeaning(id: string) {
    if (showingAnswer) return;

    setMatches((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([termId, meaningId]) => {
        if (meaningId === id || termId === selectedTermId) delete next[termId];
      });
      if (selectedTermId) next[selectedTermId] = id;
      return next;
    });
    setSelectedTermId(null);
  }

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:gap-4" data-bonus-matching-board>
      <div className="flex flex-col gap-2">
        {question.terms.map((pair) => {
          const matched = Boolean(matches[pair.id]);
          const correct = showingAnswer && matches[pair.id] === pair.id;
          const wrong = showingAnswer && matches[pair.id] !== pair.id;
          return (
            <button
              key={`term-${pair.id}`}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectTerm(pair.id)}
              className={cn("min-h-14 rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300", matched && "bg-brand/15 border-brand", selectedTermId === pair.id && "-translate-y-0.5 ring-2 ring-brand", correct && "bg-emerald-500 text-white border-emerald-500", wrong && "bg-rose-500 text-white border-rose-500", !matched && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand", showingAnswer && !matched && "opacity-60")}
              data-bonus-term={pair.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {pair.term}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {question.meanings.map((pair) => {
          const pairedTermId = Object.entries(matches).find(([, meaningId]) => meaningId === pair.id)?.[0];
          const correct = showingAnswer && pairedTermId === pair.id;
          const wrong = showingAnswer && pairedTermId !== undefined && pairedTermId !== pair.id;
          return (
            <button
              key={`meaning-${pair.id}`}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectMeaning(pair.id)}
              className={cn("min-h-14 rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300", pairedTermId && "bg-brand/15 border-brand", correct && "bg-emerald-500 text-white border-emerald-500", wrong && "bg-rose-500 text-white border-rose-500", !pairedTermId && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand", showingAnswer && !pairedTermId && "opacity-60")}
              data-bonus-meaning={pair.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {pair.meaning}
            </button>
          );
        })}
      </div>
      <BonusCheckButton
        disabled={!canCheck || showingAnswer}
        onClick={() => onSubmit("matching", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
      <span className="sr-only">{matchedMeaningIds.size}</span>
    </div>
  );
}

function SentenceOrderBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: SentenceOrderBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = new Set(selectedIds);
  const canCheck = selectedIds.length === question.tokens.length;
  const isCorrect = selectedIds.every((id, index) => id === question.tokens[index]?.id);

  function toggleToken(id: string) {
    if (showingAnswer) return;
    setSelectedIds((current) => current.includes(id)
      ? current.filter((tokenId) => tokenId !== id)
      : [...current, id]);
  }

  return (
    <div className="flex w-full flex-col gap-3" data-bonus-sentence-order>
      <div className="min-h-20 rounded-xl border border-border bg-background-card p-3 text-left" data-bonus-sentence-display>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id, index) => {
              const token = question.tokens.find((candidate) => candidate.id === id)!;
              const correct = showingAnswer && id === question.tokens[index]?.id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={showingAnswer}
                  onClick={() => toggleToken(id)}
                  className={cn("rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors", correct ? "border-emerald-500 bg-emerald-500 text-white" : showingAnswer ? "border-rose-500 bg-rose-500 text-white" : "border-brand bg-brand/15 text-foreground")}
                  data-bonus-sentence-selected={id}
                >
                  {token.text}
                </button>
              );
            })}
          </div>
        ) : <span className="text-sm text-foreground-muted">…</span>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {question.tokens.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={showingAnswer}
            onClick={() => toggleToken(token.id)}
            className={cn("rounded-md border border-border bg-background-card px-3 py-2 text-sm font-semibold transition-[transform,opacity,background-color] duration-300 hover:-translate-y-0.5", selectedSet.has(token.id) && "opacity-35", showingAnswer && "opacity-60")}
            data-bonus-sentence-token={token.id}
          >
            {token.text}
          </button>
        ))}
      </div>
      <BonusCheckButton
        disabled={!canCheck || showingAnswer}
        onClick={() => onSubmit("sentence-order", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
    </div>
  );
}

function CategorySortBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: CategorySortBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const { t } = useLocale();
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const categoryByWord = new Map(question.categories.flatMap((category) => category.wordIds.map((wordId) => [wordId, category.id] as const)));
  const canCheck = Object.keys(assignments).length === question.words.length;
  const isCorrect = question.words.every((word) => assignments[word.id] === categoryByWord.get(word.id));

  function selectWord(wordId: string) {
    if (showingAnswer) return;
    if (assignments[wordId]) {
      setAssignments((current) => {
        const next = { ...current };
        delete next[wordId];
        return next;
      });
    }
    setSelectedWordId(wordId);
  }

  function selectCategory(categoryId: string) {
    if (showingAnswer || !selectedWordId) return;
    setAssignments((current) => ({
      ...current,
      [selectedWordId]: categoryId,
    }));
    setSelectedWordId(null);
  }

  return (
    <div className="flex w-full flex-col gap-4" data-bonus-category-sort>
      <div className="flex flex-wrap justify-center gap-2">
        {question.words.map((word) => {
          const assigned = assignments[word.id];
          const correct = showingAnswer && assigned === categoryByWord.get(word.id);
          const wrong = showingAnswer && assigned !== categoryByWord.get(word.id);
          return (
            <button
              key={word.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectWord(word.id)}
              className={cn("rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,opacity,background-color] duration-300", selectedWordId === word.id && "-translate-y-0.5 ring-2 ring-brand", assigned && "bg-brand/15 border-brand", correct && "bg-emerald-500 text-white border-emerald-500", wrong && "bg-rose-500 text-white border-rose-500", !assigned && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand", showingAnswer && !assigned && "opacity-60")}
              data-bonus-category-word={word.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {word.text}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {question.categories.map((category) => {
          const words = question.words.filter((word) => assignments[word.id] === category.id);
          const categoryCorrect = showingAnswer && words.length === 3 && words.every((word) => categoryByWord.get(word.id) === category.id);
          const categoryWrong = showingAnswer && words.some((word) => categoryByWord.get(word.id) !== category.id);
          return (
            <button
              key={category.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectCategory(category.id)}
              className={cn("min-h-28 rounded-xl border border-border bg-background-card p-3 text-left transition-[background-color,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-brand", categoryCorrect && "border-emerald-500 bg-emerald-500/15", categoryWrong && "border-rose-500 bg-rose-500/15")}
              data-bonus-category={category.id}
            >
              <span className="block text-sm font-semibold text-foreground">
                {category.nameKey ? t(`cards.groups.${category.nameKey}` as never) : category.name}
              </span>
              <span className="mt-2 flex min-h-8 flex-wrap gap-1">
                {words.map((word) => <span key={word.id} className="rounded bg-background-muted px-1.5 py-1 text-xs font-semibold text-foreground-secondary">{word.text}</span>)}
              </span>
            </button>
          );
        })}
      </div>
      <BonusCheckButton
        disabled={!canCheck || showingAnswer}
        onClick={() => onSubmit("category-sort", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
    </div>
  );
}

function ImposterBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: ImposterBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const { locale, t } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const copy = getBonusCopy(locale);
  const groupLabel = t(`cards.groups.${question.groupId}` as never);
  const isCorrect = selectedId === question.correctOptionId;

  return (
    <div className="flex w-full flex-col items-center gap-4" data-bonus-imposter>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background-card px-4 py-3">
        <Image src={question.groupImageSrc} alt="" width={56} height={56} className="size-14 rounded-lg object-cover" />
        <span className="text-base font-semibold text-foreground">{groupLabel}</span>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
        {question.options.map((option) => {
          const correct = showingAnswer && option.id === question.correctOptionId;
          const wrong = showingAnswer && option.id === selectedId && !option.isImposter;
          return (
            <button
              key={option.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => setSelectedId(option.id)}
              className={cn("min-h-16 rounded-lg border border-border bg-background-card px-2 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300 hover:-translate-y-0.5 hover:border-brand", selectedId === option.id && "border-brand bg-brand/15 ring-2 ring-brand", correct && "border-emerald-500 bg-emerald-500 text-white", wrong && "border-rose-500 bg-rose-500 text-white", showingAnswer && option.id !== selectedId && !correct && "opacity-60")}
              data-bonus-imposter-option={option.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <BonusCheckButton
        disabled={!selectedId || showingAnswer}
        onClick={() => onSubmit("imposter", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
      <span className="sr-only">{copy.imposterTitle}</span>
    </div>
  );
}

function BonusCheckButton({
  disabled,
  onClick,
  onSkip,
  showingAnswer,
}: {
  disabled: boolean;
  onClick: () => void;
  onSkip: () => void;
  showingAnswer: boolean;
}) {
  const { locale } = useLocale();
  const copy = getBonusCopy(locale);
  return (
    <div className={cn("mt-1 flex w-full gap-2", showingAnswer && "invisible pointer-events-none")}>
      <QuizSkipButton
        className="min-w-0 flex-1"
        disabled={showingAnswer}
        onClick={onSkip}
      />
      <Button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="min-w-0 flex-[1.45] bg-brand text-brand-foreground hover:bg-brand-hover"
        data-bonus-check
      >
        {copy.check}
      </Button>
    </div>
  );
}

function BonusPointFlight({
  sourceRef,
  onFlightStart,
  onPointArrive,
  onComplete,
}: {
  sourceRef: RefObject<HTMLDivElement | null>;
  onFlightStart?: () => void;
  onPointArrive?: (points: number) => void;
  onComplete?: () => void;
}) {
  const [icons, setIcons] = useState<FlightIcon[]>([]);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const arrivedRef = useRef(new Set<number>());
  const onFlightStartRef = useRef(onFlightStart);
  const onPointArriveRef = useRef(onPointArrive);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onFlightStartRef.current = onFlightStart;
    onPointArriveRef.current = onPointArrive;
    onCompleteRef.current = onComplete;
  }, [onComplete, onFlightStart, onPointArrive]);

  useEffect(() => {
    const activeTimers: number[] = [];
    if (startedRef.current) return;
    startedRef.current = true;
    onFlightStartRef.current?.();

    const frame = window.requestAnimationFrame(() => {
      const source = sourceRef.current?.getBoundingClientRect();
      const target = document.querySelector<HTMLElement>("[data-quiz-total-score]")?.getBoundingClientRect();
      if (!source || !target || source.width === 0 || source.height === 0 || target.width === 0 || target.height === 0) {
        completedRef.current = true;
        onCompleteRef.current?.();
        return;
      }

      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      const iconCount = getScoreFlightIconCount(BONUS_QUESTION_POINTS);
      const nextIcons = Array.from({ length: iconCount }, (_, index) => {
        const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
        return {
          id: index,
          startX: source.left + source.width * (0.28 + Math.random() * 0.44),
          startY: source.top + source.height * (0.35 + Math.random() * 0.3),
          scatterX: (Math.random() - 0.5) * 100,
          scatterY: -25 - Math.random() * 70,
          targetX,
          targetY,
          delay: Math.round(ratio * 520),
        };
      });
      setIcons(nextIcons);
      const finishTimer = window.setTimeout(() => finishFlight(nextIcons.length), 2_300);
      activeTimers.push(finishTimer);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [sourceRef]);

  function finishFlight(iconCount: number) {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
    setIcons([]);
    if (iconCount === 0) return;
  }

  function handleIconEnd(iconId: number) {
    if (arrivedRef.current.has(iconId)) return;
    arrivedRef.current.add(iconId);
    const arrivalIndex = arrivedRef.current.size;
    onPointArriveRef.current?.(getScoreFlightAwardAtArrival(BONUS_QUESTION_POINTS, icons.length, arrivalIndex));
    playSoundEffect("points");
    vibrate("tap");

    if (arrivalIndex === icons.length) {
      finishFlight(icons.length);
    }
  }

  if (icons.length === 0) return null;

  return createPortal(
    <>
      {icons.map((icon) => (
        <span
          key={icon.id}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[80] animate-quiz-score-icon-flight"
          onAnimationEnd={() => handleIconEnd(icon.id)}
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
          <ScoreIcon size={30} />
        </span>
      ))}
    </>,
    document.body,
  );
}

type FlightIcon = {
  id: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

function getBonusTitle(copy: ReturnType<typeof getBonusCopy>, kind: BonusQuestion["kind"]) {
  if (kind === "matching") return copy.matchingTitle;
  if (kind === "sentence-order") return copy.sentenceTitle;
  if (kind === "category-sort") return copy.categoryTitle;
  return copy.imposterTitle;
}

function getBonusPrompt(copy: ReturnType<typeof getBonusCopy>, kind: BonusQuestion["kind"]) {
  if (kind === "matching") return copy.matchingPrompt;
  if (kind === "sentence-order") return copy.sentencePrompt;
  if (kind === "category-sort") return copy.categoryPrompt;
  return copy.imposterPrompt;
}
