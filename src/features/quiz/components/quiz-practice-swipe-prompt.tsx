"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";
import { getSingleLineFitFontSize } from "@/features/quiz/single-line-text-fit";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

const MAX_PROMPT_FONT_SIZE = 20;
const MIN_PROMPT_FONT_SIZE = 11;

export function QuizPracticeSwipePrompt({
  item,
  className,
}: {
  item: NormalQuizItem;
  className?: string;
}) {
  const { locale } = useLocale();
  const t = useT();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fitFontSize, setFitFontSize] = useState<number | null>(null);
  const learned = item.willLearn;
  const label = t(learned ? "quiz.practiceSwipeLearnedPrompt" : "quiz.practiceSwipeProgressPrompt");
  const badgeSource = learned
    ? "/card-status/kart_ogrenildi_madalyasi.webp"
    : "/card-status/kart_ogreniliyor_madalyasi.webp";

  useLayoutEffect(() => {
    const textElement = textRef.current;
    const rowElement = textElement?.parentElement;
    if (!textElement || !rowElement) return;

    let cancelled = false;
    const updateFitSize = () => {
      if (cancelled || !textElement.clientWidth) return;

      const previousFontSize = textElement.style.fontSize;
      textElement.style.fontSize = `${MAX_PROMPT_FONT_SIZE}px`;
      const measuredTextWidth = textElement.scrollWidth;
      const availableWidth = textElement.clientWidth;
      textElement.style.fontSize = previousFontSize;

      const nextFontSize = Math.max(
        MIN_PROMPT_FONT_SIZE,
        Math.min(
          MAX_PROMPT_FONT_SIZE,
          getSingleLineFitFontSize(
            MAX_PROMPT_FONT_SIZE,
            measuredTextWidth,
            availableWidth,
          ),
        ),
      );
      setFitFontSize((current) => current === nextFontSize ? current : nextFontSize);
    };

    updateFitSize();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateFitSize);
    resizeObserver?.observe(rowElement);
    window.addEventListener("resize", updateFitSize);
    void document.fonts?.ready.then(updateFitSize);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFitSize);
    };
  }, [label, locale]);

  return (
    <div
      className={cn("flex min-w-0 w-full items-center gap-2", className)}
      data-quiz-practice-prompt={learned ? "learned" : "progress"}
    >
      <p
        ref={textRef}
        className={cn(
          "min-w-0 flex-1 whitespace-nowrap text-start text-xl font-bold leading-tight",
          learned ? "text-action-learned" : "text-action-learn",
          canUseSuperWater(locale) && "font-super-water",
        )}
        style={fitFontSize === null ? undefined : { fontSize: `${fitFontSize}px` }}
        data-quiz-practice-prompt-text
      >
        {formatSuperWaterText(locale, label)}
      </p>
      <Image
        src={badgeSource}
        alt=""
        aria-hidden="true"
        width={44}
        height={44}
        className="size-10 shrink-0 object-contain"
        data-quiz-practice-prompt-badge
      />
    </div>
  );
}
