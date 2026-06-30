"use client";

import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";

interface QuizStreakCelebrationViewProps {
  streak: number;
  onComplete?: () => void;
}

const VISIBLE_DURATION_MS = 1300;
const EXIT_DURATION_MS = 220;

export function QuizStreakCelebrationView({
  streak,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    playSoundEffect("streak-fire");

    const timer = window.setTimeout(() => setExiting(true), VISIBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!exiting) return;

    const timer = window.setTimeout(() => onComplete?.(), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, onComplete]);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-emerald-500",
        exiting ? "animate-streak-celebration-exit" : "animate-streak-celebration-enter",
      )}
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
