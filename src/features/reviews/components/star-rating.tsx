"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "size-4 gap-0.5",
  md: "size-7 gap-1",
  lg: "size-10 gap-1.5",
};

export function StarRating({ value, onChange, readOnly = false, size = "md", label }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold text-foreground-secondary">{label}</span> : null}
      <div className="flex items-center" role={readOnly ? undefined : "radiogroup"} aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= value;
          return (
            <button
              key={star}
              type="button"
              disabled={readOnly}
              aria-checked={readOnly ? undefined : star === value}
              aria-label={`${star} yıldız`}
              onClick={() => onChange?.(star)}
              className={cn(
                "relative inline-flex items-center justify-center rounded-sm p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                readOnly ? "cursor-default" : "cursor-pointer hover:scale-110",
                sizeClasses[size],
              )}
            >
              <Star
                className={cn(
                  "size-full transition-colors",
                  filled ? "fill-amber-400 text-amber-400" : "fill-background-muted text-foreground-muted",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
