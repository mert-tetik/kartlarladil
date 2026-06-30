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
  "translate-y-3",
  "-translate-y-1",
  "-translate-y-4",
  "-translate-y-1",
  "translate-y-3",
] as const;

const PANEL_REVEAL_DELAY_MS = 260;
const DROP_DURATION_MS = 420;
const STAGGER_MS = 130;

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
        "relative flex h-10 items-end justify-center gap-3 overflow-visible sm:h-12 sm:gap-4",
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

        if (filled) {
          return (
            <div key={index} className={cn("flex items-end", offset)}>
              <Star
                className={cn(
                  "size-7 origin-bottom sm:size-9",
                  "fill-amber-400 text-amber-400",
                  ready ? "animate-star-drop" : "opacity-0",
                )}
                style={{
                  animationDelay: `${PANEL_REVEAL_DELAY_MS + index * STAGGER_MS}ms`,
                }}
                data-quiz-star="filled"
              />
            </div>
          );
        }

        return (
          <div key={index} className={cn("flex items-end", offset)}>
            <Star
              className={cn(
                "size-7 origin-bottom sm:size-9",
                "fill-transparent text-foreground-muted",
                showEmpty ? "opacity-100" : "opacity-0",
                "transition-none",
              )}
              data-quiz-star="empty"
            />
          </div>
        );
      })}
    </div>
  );
}
