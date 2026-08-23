"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

interface QuizStarRatingProps {
  rating: number;
  max?: number;
  className?: string;
}

const ARC_OFFSETS = [
  "translate-y-2",
  "translate-y-0",
  "-translate-y-2",
  "translate-y-0",
  "translate-y-2",
] as const;

const STAR_SIZES = [
  "size-7 sm:size-9",
  "size-[2.45rem] sm:size-[2.9rem]",
  "size-[3rem] sm:size-[3.45rem]",
  "size-[2.45rem] sm:size-[2.9rem]",
  "size-7 sm:size-9",
] as const;

const PANEL_REVEAL_DELAY_MS = 260;
const DROP_DURATION_MS = 500;
const STAGGER_MS = 120;
const STAR_IMAGE_SRC = "/quiz/result-cards/star.png";

export function QuizStarRating({ rating, max = 5, className }: QuizStarRatingProps) {
  const clampedRating = Math.max(0, Math.min(max, Math.round(rating)));
  const [ready, setReady] = useState(false);
  const [showEmpty, setShowEmpty] = useState(clampedRating === 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), PANEL_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (clampedRating === 0) return;
    const lastFilledIndex = clampedRating - 1;
    const revealAt = PANEL_REVEAL_DELAY_MS + lastFilledIndex * STAGGER_MS + DROP_DURATION_MS;
    const timer = window.setTimeout(() => setShowEmpty(true), revealAt);
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
        "relative flex h-14 items-end justify-center gap-5 overflow-visible sm:h-16 sm:gap-6",
        className,
      )}
      role="img"
      aria-label={`${clampedRating} out of ${max} stars`}
      data-quiz-star-rating
      data-quiz-star-rating-value={clampedRating}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < clampedRating;
        const offset = ARC_OFFSETS[index];
        const sizeClass = STAR_SIZES[index];

        if (filled) {
          return (
            <div key={index} className={cn("flex items-end", offset)}>
              <Image
                src={STAR_IMAGE_SRC}
                alt=""
                width={64}
                height={64}
                className={cn(
                  sizeClass,
                  "origin-bottom",
                  "object-contain",
                  ready ? "animate-star-drop" : "opacity-0",
                )}
                style={{
                  animationDelay: `${index * STAGGER_MS}ms`,
                }}
                data-quiz-star="filled"
                data-quiz-star-index={index}
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
              data-quiz-star="empty"
              data-quiz-star-index={index}
            >
              <Image
                src={STAR_IMAGE_SRC}
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
                  maskImage: `url("${STAR_IMAGE_SRC}")`,
                  maskPosition: "center",
                  maskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskImage: `url("${STAR_IMAGE_SRC}")`,
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
