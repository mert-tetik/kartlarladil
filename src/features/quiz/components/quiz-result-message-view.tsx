"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { AchievementCardSection } from "@/features/quiz/components/quiz-achievement-card-section";
import type { VocabularyCard } from "@/types/domain";

const RESULT_MESSAGE_TRANSITION_DURATION_MS = 360;

export interface QuizResultMessageViewProps {
  onComplete: () => void;
  onResultActionPress?: () => void;
  learnedCards?: readonly VocabularyCard[];
  advancedCards?: readonly VocabularyCard[];
  advancedCardProgress?: Readonly<Record<string, number>>;
  enterWithCss?: boolean;
}

export function QuizResultMessageView({
  onComplete,
  onResultActionPress,
  learnedCards = [],
  advancedCards = [],
  advancedCardProgress,
  enterWithCss = false,
}: QuizResultMessageViewProps) {
  const { locale, t } = useLocale();
  const [cardsVisible, setCardsVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const completionTimerRef = useRef<number | null>(null);
  const completionStartedRef = useRef(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setCardsVisible(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const handleContinue = () => {
    if (!cardsVisible || exiting || completionStartedRef.current) return;

    completionStartedRef.current = true;
    onResultActionPress?.();
    if (!onResultActionPress) {
      playSoundEffect("result-action-press");
    }
    setExiting(true);
    completionTimerRef.current = window.setTimeout(() => {
      completionTimerRef.current = null;
      onComplete();
    }, RESULT_MESSAGE_TRANSITION_DURATION_MS);
  };

  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--background)] p-4",
        enterWithCss && !exiting && "quiz-flow-enter-right",
        exiting && "quiz-flow-exit-left",
      )}
      data-quiz-result-message-view
      data-quiz-result-message-cards
    >
      <div className="pointer-events-auto h-full min-h-0 w-full overflow-y-auto overscroll-contain pb-24">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 p-4 sm:p-6">
          {learnedCards.length > 0 ? (
            <AchievementCardSection
              title={t("quiz.resultLearned")}
              cards={learnedCards}
              tone="learned"
              reveal={cardsVisible}
              exiting={exiting}
              staggerOffsetMs={0}
            />
          ) : null}
          {advancedCards.length > 0 ? (
            <AchievementCardSection
              title={t("quiz.resultAdvanced")}
              cards={advancedCards}
              tone="advanced"
              progressByCardId={advancedCardProgress}
              reveal={cardsVisible}
              exiting={exiting}
              staggerOffsetMs={learnedCards.length > 0 ? 850 : 0}
            />
          ) : null}
          {learnedCards.length === 0 && advancedCards.length === 0 ? (
            <p className="text-center text-base font-semibold text-foreground/60">
              {formatSuperWaterUppercaseText(locale, t("quiz.continue"))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-8">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!cardsVisible || exiting}
          className={cn(
            "pointer-events-auto mx-auto block h-14 w-full max-w-md rounded-2xl bg-brand px-5 text-lg font-bold uppercase text-brand-foreground shadow-[0_6px_0_var(--brand-hover)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none sm:h-16",
            canUseSuperWater(locale) && "font-super-water",
            cardsVisible && !exiting ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          data-quiz-result-message-continue
        >
          {formatSuperWaterUppercaseText(locale, t("quiz.continue"))}
        </button>
      </div>
    </div>
  );
}
