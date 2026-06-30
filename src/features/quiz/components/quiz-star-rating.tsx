"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function QuizStarRating({ rating, max = 5, className }: QuizStarRatingProps) {
  const clampedRating = Math.max(0, Math.min(max, Math.round(rating)));

  return (
    <div
      className={cn(
        "relative flex h-10 items-end justify-center gap-1 overflow-visible sm:h-12 sm:gap-1.5",
        className,
      )}
      role="img"
      aria-label={`${clampedRating} out of ${max} stars`}
      data-quiz-star-rating
      data-quiz-star-rating-value={clampedRating}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < clampedRating;
        return (
          <Star
            key={index}
            className={cn(
              "size-7 origin-bottom scale-150 transition-all duration-300 sm:size-9",
              ARC_OFFSETS[index],
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-foreground-muted",
            )}
            data-quiz-star={filled ? "filled" : "empty"}
          />
        );
      })}
    </div>
  );
}
