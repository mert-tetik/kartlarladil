"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface QuizStarRatingProps {
  rating: number;
  max?: number;
  className?: string;
}

const ARC_OFFSETS = [
  "translate-y-4",
  "translate-y-1",
  "-translate-y-5",
  "translate-y-1",
  "translate-y-4",
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
              <Star
                className={cn(
                  sizeClass,
                  "origin-bottom",
                  "fill-amber-400 text-amber-400",
                  ready ? "animate-star-drop" : "opacity-0",
                )}
                style={{
                  animationDelay: `${PANEL_REVEAL_DELAY_MS + index * STAGGER_MS}ms`,
                }}
                data-quiz-star="filled"
                data-quiz-star-index={index}
              />
            </div>
          );
        }

        return (
          <div key={index} className={cn("flex items-end", offset)}>
            <Star
              className={cn(
                sizeClass,
                "origin-bottom",
                "fill-transparent text-foreground-muted",
                showEmpty ? "opacity-100" : "opacity-0",
                "transition-none",
              )}
              data-quiz-star="empty"
              data-quiz-star-index={index}
            />
          </div>
        );
      })}
    </div>
  );
}
