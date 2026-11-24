"use client";

import { useEffect, useRef, useState, type AnimationEvent } from "react";
import { BookOpenCheck, Sparkles } from "lucide-react";
import { QuizWordButton } from "@/features/quiz/components/quiz-word-button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import type { QuizPresentationMode } from "@/features/quiz/quiz-presentation-mode";

export function QuizPresentationSelection({
  preparing,
  onSelect,
}: {
  preparing: boolean;
  onSelect: (mode: QuizPresentationMode) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const useSuperWater = canUseSuperWater(locale);
  const [selectedMode, setSelectedMode] = useState<QuizPresentationMode | null>(null);
  const selectedModeRef = useRef<QuizPresentationMode | null>(null);
  const animationFallbackRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (animationFallbackRef.current !== null) {
      window.clearTimeout(animationFallbackRef.current);
    }
  }, []);

  function selectMode(mode: QuizPresentationMode) {
    if (selectedModeRef.current) return;
    selectedModeRef.current = mode;
    setSelectedMode(mode);
    playSoundEffect("correct");
    animationFallbackRef.current = window.setTimeout(() => finishSelection(mode), 900);
  }

  function finishSelection(mode: QuizPresentationMode) {
    if (selectedModeRef.current !== mode) return;
    selectedModeRef.current = null;
    if (animationFallbackRef.current !== null) {
      window.clearTimeout(animationFallbackRef.current);
      animationFallbackRef.current = null;
    }
    onSelect(mode);
  }

  function handleOptionAnimationEnd(
    event: AnimationEvent<HTMLButtonElement>,
    mode: QuizPresentationMode,
  ) {
    if (event.animationName === "quiz-word-button-correct") {
      finishSelection(mode);
    }
  }

  return (
    <section
      className="animate-screen-pop relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#333] bg-black p-5 text-white sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4"
      data-quiz-presentation-selection
      data-testid="quiz-presentation-selection"
      aria-labelledby="quiz-presentation-title"
      aria-busy={preparing}
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <h2
          id="quiz-presentation-title"
          className={cn("text-2xl font-semibold text-foreground sm:text-3xl", useSuperWater && "font-super-water")}
        >
          {formatSuperWaterText(locale, t("quiz.choosePresentationTitle"))}
        </h2>

        <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2">
          <QuizWordButton
            wordType="correct"
            disabled={selectedMode !== null && selectedMode !== "easy"}
            onClick={() => selectMode("easy")}
            onAnimationEnd={(event) => handleOptionAnimationEnd(event, "easy")}
            className={cn(
              "quiz-count-selection-option group min-h-44 w-full flex-col items-stretch justify-center rounded-xl px-5 py-4 text-left text-white disabled:cursor-wait disabled:opacity-70 sm:min-h-52 sm:px-6 sm:py-5",
              useSuperWater && "font-super-water",
            )}
            data-quiz-presentation="easy"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 shrink-0" aria-hidden="true" />
              <span className="text-xl font-semibold sm:text-2xl">
                {formatSuperWaterText(locale, t("quiz.presentationEasy"))}
              </span>
            </div>
            <span className={cn("mt-3 text-sm leading-6 text-white/90 sm:text-base", useSuperWater && "font-sans")}>
              {t("quiz.presentationEasyDescription")}
            </span>
          </QuizWordButton>

          <QuizWordButton
            wordType="correct"
            disabled={selectedMode !== null && selectedMode !== "classic"}
            onClick={() => selectMode("classic")}
            onAnimationEnd={(event) => handleOptionAnimationEnd(event, "classic")}
            className={cn(
              "quiz-count-selection-option group min-h-44 w-full flex-col items-stretch justify-center rounded-xl px-5 py-4 text-left text-white disabled:cursor-wait disabled:opacity-70 sm:min-h-52 sm:px-6 sm:py-5",
              useSuperWater && "font-super-water",
            )}
            data-quiz-presentation="classic"
          >
            <div className="flex items-center gap-3">
              <BookOpenCheck className="size-6 shrink-0" aria-hidden="true" />
              <span className="text-xl font-semibold sm:text-2xl">
                {formatSuperWaterText(locale, t("quiz.presentationClassic"))}
              </span>
            </div>
            <span className={cn("mt-3 text-sm leading-6 text-white/90 sm:text-base", useSuperWater && "font-sans")}>
              {t("quiz.presentationClassicDescription")}
            </span>
          </QuizWordButton>
        </div>
        {preparing ? (
          <p className="mt-4 text-sm text-foreground-muted" role="status" aria-live="polite">
            {t("quiz.loadingTitle")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
