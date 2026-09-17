"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SEGMENTED_TOGGLE_SELECTED_CLASS =
  "bg-gradient-to-r from-[var(--premium-start)] via-[var(--reward-start)] to-[var(--premium-end)] !text-slate-950 hover:brightness-105";

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  labelClassName,
  ariaLabel,
  className,
  selectedClassName,
}: {
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
  labelClassName?: string;
  ariaLabel?: string;
  className?: string;
  selectedClassName?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background-muted p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              selected
                ? cn(selectedClassName ?? SEGMENTED_TOGGLE_SELECTED_CLASS, "shadow-sm")
                : "text-foreground-secondary hover:text-foreground",
              labelClassName,
            )}
            aria-pressed={selected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
