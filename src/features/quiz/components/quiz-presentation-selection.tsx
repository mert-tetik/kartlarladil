"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent } from "react";
import { QuizWordButton } from "@/features/quiz/components/quiz-word-button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import type { QuizPresentationMode } from "@/features/quiz/quiz-presentation-mode";
import { QUIZ_PRESENTATION_SELECTION_ARTWORK } from "@/features/quiz/quiz-video-preload";

const CLASSIC_ARTWORK_ORDER = [0, 4, 5, 1] as const;
let classicArtworkSequencePosition = 0;

function getCurrentClassicArtwork() {
  const artworkIndex = CLASSIC_ARTWORK_ORDER[classicArtworkSequencePosition];
  return QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[artworkIndex] ??
    QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[0];
}

function consumeNextClassicArtwork() {
  const artwork = getCurrentClassicArtwork();
  classicArtworkSequencePosition =
    (classicArtworkSequencePosition + 1) % CLASSIC_ARTWORK_ORDER.length;
  return artwork;
}

// Keep artwork outside QuizWordButton so its feedback clip-path cannot crop it.
function QuizPresentationArtwork({
  mode,
  source,
}: {
  mode: QuizPresentationMode;
  source: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute ${mode === "classic" ? "left-[32px]" : "-left-[3px]"} bottom-0 z-[30] h-[188px] origin-bottom-left scale-[1.2] aspect-[4/5] sm:h-[220px] sm:scale-[1.14] md:scale-[1.2]`}
      data-quiz-presentation-artwork={mode}
    >
      <Image
        src={source}
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width: 639px) 45vw, 18rem"
        priority
        unoptimized
        className="object-contain"
      />
    </div>
  );
}

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
  const [classicArtwork, setClassicArtwork] = useState(getCurrentClassicArtwork);
  const classicArtworkConsumedRef = useRef(false);
  const selectedModeRef = useRef<QuizPresentationMode | null>(null);
  const animationFallbackRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (classicArtworkConsumedRef.current) return;
    classicArtworkConsumedRef.current = true;
    setClassicArtwork(consumeNextClassicArtwork());
  }, []);

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
      <div className="mx-auto w-full max-w-3xl -translate-y-10 text-center" data-quiz-presentation-content>
        <h2
          id="quiz-presentation-title"
          className={cn("-translate-y-[30px] text-4xl font-semibold text-foreground sm:text-5xl", useSuperWater && "font-super-water")}
        >
          {formatSuperWaterText(locale, t("quiz.choosePresentationTitle"))}
        </h2>

        <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2">
          <div className="relative w-full -translate-y-[15px]" data-quiz-presentation-option="easy">
            <QuizWordButton
              wordType="correct"
              disabled={selectedMode !== null && selectedMode !== "easy"}
              onClick={() => selectMode("easy")}
              onAnimationEnd={(event) => handleOptionAnimationEnd(event, "easy")}
              correctClassName="quiz-presentation-button-correct"
              className={cn(
                "quiz-count-selection-option group min-h-44 w-full items-stretch justify-center overflow-visible rounded-xl px-0 py-0 text-left text-white disabled:cursor-wait disabled:opacity-70 sm:min-h-52",
                useSuperWater && "font-super-water",
              )}
              data-quiz-presentation-button
              data-quiz-presentation="easy"
            >
              <div className="relative h-[164px] w-full sm:h-[196px]">
                <span className="relative z-10 ml-auto mr-2 flex h-full w-[38%] -translate-x-[20px] items-center justify-center text-center sm:w-[32%] md:w-[38%]">
                  <span data-quiz-presentation-title="easy" className="text-3xl font-semibold leading-tight sm:text-4xl">
                    {formatSuperWaterText(locale, t("quiz.presentationEasy"))}
                  </span>
                </span>
              </div>
            </QuizWordButton>
            <QuizPresentationArtwork
              mode="easy"
              source={QUIZ_PRESENTATION_SELECTION_ARTWORK.easy}
            />
          </div>

          <div className="relative w-full" data-quiz-presentation-option="classic">
            <QuizWordButton
              wordType="correct"
              disabled={selectedMode !== null && selectedMode !== "classic"}
              onClick={() => selectMode("classic")}
              onAnimationEnd={(event) => handleOptionAnimationEnd(event, "classic")}
              correctClassName="quiz-presentation-button-correct"
              className={cn(
                "quiz-count-selection-option group min-h-44 w-full items-stretch justify-center overflow-visible rounded-xl px-0 py-0 text-left text-white disabled:cursor-wait disabled:opacity-70 sm:min-h-52",
                useSuperWater && "font-super-water",
              )}
              data-quiz-presentation-button
              data-quiz-presentation="classic"
            >
              <div className="relative h-[164px] w-full sm:h-[196px]">
                <span className="relative z-10 ml-auto mr-2 flex h-full w-[38%] -translate-x-[20px] items-center justify-center text-center sm:w-[32%] md:w-[38%]">
                  <span data-quiz-presentation-title="classic" className="text-3xl font-semibold leading-tight sm:text-4xl">
                    {formatSuperWaterText(locale, t("quiz.presentationClassic"))}
                  </span>
                </span>
              </div>
            </QuizWordButton>
            <QuizPresentationArtwork mode="classic" source={classicArtwork} />
          </div>
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
