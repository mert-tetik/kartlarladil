"use client";

import { useState } from "react";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { QuizWordButton } from "@/features/quiz/components/quiz-word-button";
import { getRandomQuizCharacter, QuizSpeechBubble } from "@/features/quiz/components/quiz-speech-bubble";
import {
  getChestPreviewPairForCount,
  QUIZ_COUNT_OPTIONS,
} from "@/features/quiz/chest-rewards";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import type { LocaleCode, PracticeMode } from "@/types/domain";
import { QUIZ_COUNT_SELECTION_VIDEO_SOURCE } from "@/features/quiz/quiz-video-preload";

const COUNT_OPTION_NAMES: Record<LocaleCode, Record<number, string>> = {
  tr: { 10: "Hızlı", 20: "Dengeli", 30: "Uzun", 50: "Maraton" },
  en: { 10: "Quick", 20: "Steady", 30: "Long", 50: "Marathon" },
  de: { 10: "Schnell", 20: "Ausgewogen", 30: "Lang", 50: "Marathon" },
  ru: { 10: "Быстро", 20: "Ровно", 30: "Долго", 50: "Марафон" },
  fr: { 10: "Rapide", 20: "Équilibré", 30: "Long", 50: "Marathon" },
  es: { 10: "Rápido", 20: "Equilibrado", 30: "Largo", 50: "Maratón" },
  it: { 10: "Veloce", 20: "Bilanciato", 30: "Lungo", 50: "Maratona" },
  pt: { 10: "Rápido", 20: "Equilibrado", 30: "Longo", 50: "Maratona" },
  nl: { 10: "Snel", 20: "Gebalanceerd", 30: "Lang", 50: "Marathon" },
  pl: { 10: "Szybko", 20: "Zbalansowany", 30: "Długo", 50: "Maraton" },
  ar: { 10: "سريع", 20: "متوازن", 30: "طويل", 50: "ماراثون" },
  ja: { 10: "クイック", 20: "バランス", 30: "ロング", 50: "マラソン" },
  ko: { 10: "빠르게", 20: "균형 있게", 30: "길게", 50: "마라톤" },
  "zh-CN": { 10: "快速", 20: "均衡", 30: "较长", 50: "马拉松" },
};

export function QuizCountSelection({
  mode,
  availableCount,
  locked = false,
  onSelect,
}: {
  mode: PracticeMode;
  availableCount: number;
  locked?: boolean;
  onSelect: (count: number) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const showChestTiers = mode === "active";
  const [character] = useState(getRandomQuizCharacter);
  const [animatingCount, setAnimatingCount] = useState<number | null>(null);

  function handleSelect(count: number) {
    if (locked || animatingCount !== null || count > availableCount) return;

    setAnimatingCount(count);
    playSoundEffect("correct");
  }

  function handleFeedbackEnd(count: number, animationName: string) {
    if (count !== animatingCount || animationName !== "quiz-word-button-correct") return;
    onSelect(count);
  }

  return (
    <section
      data-quiz-count-selection
      className={cn(
        "quiz-flow-screen relative isolate flex h-full min-h-0 w-full flex-1 flex-col items-center justify-start overflow-hidden bg-transparent px-3 py-5 max-lg:pt-[calc(1.25rem+var(--app-header-height))] sm:px-5 sm:py-7",
      )}
    >
      <div className="w-full max-w-xl">
        <div className="quiz-count-selection-mobile-stack">
          <QuizSpeechBubble
            character={character}
            term={formatSuperWaterText(locale, t("quiz.chooseCountTitle"))}
            language={locale}
            showSpeaker={false}
            largeCharacter
            characterVideoSrc={QUIZ_COUNT_SELECTION_VIDEO_SOURCE}
            characterClassName="quiz-count-selection-character"
            bubbleClassName="quiz-count-selection-bubble"
            disableEntryOffset
            className="quiz-count-selection-speech"
          />
        <div
          className="mx-auto mt-3 flex w-full flex-col gap-3 sm:mt-5 sm:gap-4"
          data-quiz-count-options
        >
          {QUIZ_COUNT_OPTIONS.map((count) => {
            const unavailable = locked || count > availableCount;
            const selectionLocked = animatingCount !== null;
            const previewPair = showChestTiers ? getChestPreviewPairForCount(count) : undefined;
            const name = COUNT_OPTION_NAMES[locale][count];

            return (
              <QuizWordButton
                key={count}
                wordType="correct"
                disabled={unavailable || selectionLocked}
                aria-label={`${name}: ${formatNumber(locale, count)}`}
                onClick={() => handleSelect(count)}
                onAnimationEnd={(event) => handleFeedbackEnd(count, event.animationName)}
                className={cn(
                  "quiz-count-selection-option h-20 min-h-0 w-full justify-center px-4 py-2 sm:h-24 sm:px-5",
                  unavailable && "grayscale opacity-45",
                )}
              >
                <span className="flex w-full flex-col items-center justify-center gap-1 pb-1">
                  <span className="flex items-center justify-center gap-3 pb-1 pt-2 text-center">
                    <span className="truncate text-base font-semibold leading-none sm:text-lg">{name}</span>
                    <span className="shrink-0 text-sm font-semibold sm:text-base">
                      {formatNumber(locale, count)} {t("quiz.countLabel")}
                    </span>
                  </span>
                  {previewPair ? (
                    <span className="flex items-center justify-center gap-2 pb-1 sm:gap-3">
                      {previewPair.map((tier) => (
                        <ChestIcon key={tier} tier={tier} className="size-8 shrink-0 sm:size-9" />
                      ))}
                    </span>
                  ) : null}
                </span>
              </QuizWordButton>
            );
          })}
        </div>
        </div>
      </div>
    </section>
  );
}
