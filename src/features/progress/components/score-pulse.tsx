"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScorePulse({
  pulse,
  className,
  children,
}: {
  pulse: number | boolean;
  className?: string;
  children: ReactNode;
}) {
  const pulseIndex = typeof pulse === "number" ? pulse : pulse ? 1 : 0;
  const pulseClassName = pulseIndex > 0
    ? pulseIndex % 2 === 0
      ? "animate-score-bobble-alt"
      : "animate-score-bobble"
    : undefined;

  return (
    <span
      className={cn("inline-flex shrink-0 origin-center", pulseClassName, className)}
      data-score-pulse-group
    >
      {children}
    </span>
  );
}
