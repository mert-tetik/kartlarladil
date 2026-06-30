"use client";

import { createPortal } from "react-dom";
import { Flame } from "lucide-react";

interface QuizStreakCelebrationViewProps {
  streak: number;
}

export function QuizStreakCelebrationView({ streak }: QuizStreakCelebrationViewProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-emerald-500 animate-screen-pop"
      data-streak-celebration-view
      aria-hidden="true"
    >
      <div className="flex items-center gap-4">
        <span
          className="text-7xl font-black text-white sm:text-8xl lg:text-9xl"
          data-streak-count
        >
          {streak}
        </span>
        <Flame
          className="size-16 text-red-500 animate-streak-fire sm:size-20"
          fill="currentColor"
          data-streak-fire-icon
        />
      </div>
    </div>,
    document.body,
  );
}
