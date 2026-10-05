"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

interface QuizMedalRatingProps {
  rating: number;
  max?: number;
  className?: string;
  style?: CSSProperties;
  onRevealComplete?: () => void;
}

const ARC_OFFSETS = [
  "translate-y-2",
  "translate-y-0",
  "-translate-y-2",
  "translate-y-0",
  "translate-y-2",
] as const;

const MEDAL_SIZES = [
  "size-9 sm:size-11",
  "size-[3rem] sm:size-[3.5rem]",
  "size-[3.5rem] sm:size-[4rem]",
  "size-[3rem] sm:size-[3.5rem]",
  "size-9 sm:size-11",
] as const;

const PANEL_REVEAL_DELAY_MS = 260;
const DROP_DURATION_MS = 500;
const STAGGER_MS = 120;
const MEDAL_IMAGE_SRC = "/quiz/result-cards/star.png?v=20261003-2";

export function QuizMedalRating({
  rating,
  max = 5,
  className,
  style,
  onRevealComplete,
}: QuizMedalRatingProps) {
  const clampedRating = Math.max(0, Math.min(max, Math.round(rating)));
  const [ready, setReady] = useState(false);
  const [showEmpty, setShowEmpty] = useState(clampedRating === 0);
  const onRevealCompleteRef = useRef(onRevealComplete);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), PANEL_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (clampedRating === 0) return;
    const lastFilledIndex = clampedRating - 1;
    const revealAt = PANEL_REVEAL_DELAY_MS + lastFilledIndex * STAGGER_MS + DROP_DURATION_MS;
    const timer = window.setTimeout(() => {
      setShowEmpty(true);
      playSoundEffect("quiz-medals-complete");
      onRevealCompleteRef.current?.();
    }, revealAt);
    return () => window.clearTimeout(timer);
  }, [clampedRating]);

  useEffect(() => {
    if (clampedRating === 0) return;

    const timers = Array.from({ length: clampedRating }, (_, index) =>
      window.setTimeout(() => {
        playSoundEffect("points");
        vibrate("tap");
      }, PANEL_REVEAL_DELAY_MS + index * STAGGER_MS + DROP_DURATION_MS),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [clampedRating]);

  return (
    <div
      className={cn(
        "relative flex h-20 items-end justify-center gap-5 overflow-visible sm:h-24 sm:gap-6",
        className,
      )}
      style={style}
      role="img"
      aria-label={`${clampedRating} out of ${max} medals`}
      data-quiz-medal-rating
      data-quiz-medal-rating-value={clampedRating}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < clampedRating;
        const offset = ARC_OFFSETS[index];
        const sizeClass = MEDAL_SIZES[index];

        if (filled) {
          return (
            <div key={index} className={cn("flex items-end", offset)}>
              <Image
                src={MEDAL_IMAGE_SRC}
                alt=""
                width={64}
                height={64}
                className={cn(
                  sizeClass,
                  "origin-bottom",
                  "object-contain",
                  ready ? "animate-medal-drop" : "opacity-0",
                )}
                style={{
                  animationDelay: `${index * STAGGER_MS}ms`,
                }}
                data-quiz-medal="filled"
                data-quiz-medal-index={index}
              />
            </div>
          );
        }

        return (
          <div key={index} className={cn("flex items-end", offset)}>
            <div
              className={cn(
                "relative origin-bottom",
                sizeClass,
                showEmpty ? "opacity-100" : "opacity-0",
                "transition-none",
              )}
              data-quiz-medal="empty"
              data-quiz-medal-index={index}
            >
              <Image
                src={MEDAL_IMAGE_SRC}
                alt=""
                fill
                sizes="4rem"
                className="object-contain opacity-20 grayscale"
                aria-hidden="true"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-foreground-muted"
                style={{
                  maskImage: `url("${MEDAL_IMAGE_SRC}")`,
                  maskPosition: "center",
                  maskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskImage: `url("${MEDAL_IMAGE_SRC}")`,
                  WebkitMaskPosition: "center",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
