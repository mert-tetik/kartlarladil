"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export interface MainPointsDisplayBackgroundProps {
  pulse?: number | boolean;
  className?: string;
}

export function MainPointsDisplayBackground({
  pulse = false,
  className,
}: MainPointsDisplayBackgroundProps) {
  const pulseActive = typeof pulse === "number" ? pulse > 0 : pulse;
  const pulseIndex = typeof pulse === "number" ? pulse : pulseActive ? 1 : 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 isolate origin-center overflow-hidden rounded-full transform-gpu will-change-transform",
        pulseActive && (pulseIndex % 2 === 0 ? "animate-score-bobble-alt" : "animate-score-bobble"),
        className,
      )}
      data-main-points-display-background
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex">
        <Image
          src="/main-points-display-background-left.png"
          alt=""
          width={83}
          height={160}
          className="h-full w-auto shrink-0 object-fill"
          aria-hidden="true"
        />
        <Image
          src="/main-points-display-background-center.png"
          alt=""
          width={251}
          height={160}
          className="relative z-10 -mx-px h-full min-w-0 flex-1 object-fill"
          aria-hidden="true"
        />
        <Image
          src="/main-points-display-background-right.png"
          alt=""
          width={83}
          height={160}
          className="h-full w-auto shrink-0 object-fill"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
