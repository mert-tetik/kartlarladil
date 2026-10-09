"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { getRandomWordRepetitionCharacterImage } from "@/features/quiz/quiz-word-repetition-character";
import {
  QuizSpeechBubble,
  getRandomQuizCharacter,
} from "@/features/quiz/components/quiz-speech-bubble";
import { useLocale, useT } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import {
  canUseSuperWater,
  formatSuperWaterText,
} from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

export function QuizWordRepetitionView({
  card,
  index,
  total,
  enterWithCss,
  onComplete,
  onExit,
}: {
  card: VocabularyCard;
  index: number;
  total: number;
  enterWithCss: boolean;
  onComplete: () => void;
  onExit: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [character] = useState(() => ({
    ...getRandomQuizCharacter(),
    imageSrc: getRandomWordRepetitionCharacterImage(),
  }));
  const progress = Math.min(100, ((index + 1) / Math.max(1, total)) * 100);
  const translation = getCardTranslation(card, locale);
  const exampleSentence = card.examples[0]?.sentence || card.example;

  useEffect(() => {
    speakCardTerm(card.term, card.language);
  }, [card.id, card.language, card.term]);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[60] flex h-16 items-center gap-3 bg-background px-4 text-white lg:hidden"
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
          aria-label={`${index + 1} / ${total}`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          data-quiz-session-progress
        >
          <div className="relative mr-[14px]">
            <Progress
              value={progress}
              className="h-[18px] rounded-full bg-[#262626]"
              indicatorClassName="bg-amber-400 transition-[width] duration-300 ease-out"
              indicatorOverlayClassName="left-[5px] right-[5px] top-[calc(50%_-_3px)] bottom-auto h-[5px] -translate-y-1/2 rounded-full bg-white/50"
            />
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 top-[var(--app-header-height)] z-[55] flex h-14 items-center bg-background px-4 py-1.5 lg:hidden"
        data-mobile-quiz-question-prompt
      >
        <p
          className={cn(
            "line-clamp-2 min-w-0 max-w-full text-left text-xl font-bold leading-none text-rose-500",
            canUseSuperWater(locale) && "font-super-water",
          )}
          data-quiz-mobile-prompt
        >
          {formatSuperWaterText(locale, t("quiz.wordRepetitionTitle"))}
        </p>
      </div>

      <div
        className="quiz-transition-viewport relative mx-auto flex h-auto w-full max-w-5xl flex-col justify-center overflow-x-hidden overflow-y-hidden bg-background max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(5rem+15px+env(safe-area-inset-bottom))] max-lg:top-[var(--app-header-height)] max-lg:max-w-none max-lg:justify-start max-lg:overflow-hidden max-lg:overscroll-none lg:h-full"
        data-learn-quiz-page="quiz"
        data-quiz-word-repetition
      >
        <div
          key={card.id}
          className={cn(
            enterWithCss && "quiz-flow-enter-right",
            "relative -top-5 flex min-h-full w-full flex-col items-center justify-center gap-8 px-4 py-8 pt-24 lg:gap-10 lg:px-0 lg:py-12",
          )}
        >
          <QuizSpeechBubble
            character={character}
            term={t("quiz.wordRepetitionInstruction")}
            language={card.language}
            showSpeaker={false}
            termClassName="text-2xl sm:text-3xl lg:text-4xl"
            largeCharacter
            className="relative -top-5 !max-w-2xl !border-b-0"
            bubbleClassName="!bg-background"
          />

          <div className="flex w-full max-w-2xl flex-col items-center gap-4 text-center">
            <p className="max-w-2xl break-words text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {card.term} = {translation}
            </p>
            <p className="max-w-xl break-words text-base font-medium italic leading-relaxed text-foreground/75 sm:text-lg">
              {exampleSentence}
            </p>
          </div>

        </div>

      </div>

      <div data-quiz-bottom-actions style={{ borderTop: 0 }}>
        <div className="flex w-full justify-center">
          <div className="quiz-action-depth quiz-action-depth--check w-full max-w-sm">
            <Button
              type="button"
              onClick={() => {
                playSoundEffect("word-repetition-complete");
                onComplete();
              }}
              className="quiz-action-scale w-full bg-brand text-lg font-bold text-white hover:bg-brand-hover"
              data-quiz-word-repetition-complete
            >
              <span
                className={cn(
                  canUseSuperWater(locale) && "font-super-water",
                )}
              >
                {formatSuperWaterText(locale, t("quiz.wordRepetitionComplete"))}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
