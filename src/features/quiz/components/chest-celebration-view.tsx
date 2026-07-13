"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface ChestCelebrationViewProps {
  onComplete: () => void;
}

const CELEBRATION_MESSAGE_KEYS = [
  "quiz.chestCelebration1",
  "quiz.chestCelebration2",
  "quiz.chestCelebration3",
  "quiz.chestCelebration4",
  "quiz.chestCelebration5",
  "quiz.chestCelebration6",
  "quiz.chestCelebration7",
  "quiz.chestCelebration8",
] as const satisfies readonly string[];

const CELEBRATION_DURATION_MS = 2500;

export function ChestCelebrationView({ onComplete }: ChestCelebrationViewProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [messageKey] = useState(() =>
    CELEBRATION_MESSAGE_KEYS[Math.floor(Math.random() * CELEBRATION_MESSAGE_KEYS.length)],
  );
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setVisible(true), 50);
    const exitTimer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => completeRef.current?.(), 300);
    }, CELEBRATION_DURATION_MS);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-1 items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 p-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "scale-100 opacity-100" : "scale-[1.025] opacity-0",
      )}
      data-chest-celebration-view
    >
      <div
        className={cn(
          "flex max-w-[22rem] items-center justify-center text-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-xl",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0",
        )}
      >
        <p
          className={cn(
            "text-balance text-4xl font-black leading-tight text-white [filter:grayscale(1)_brightness(0)_invert(1)] sm:text-6xl",
            visible && "animate-pulse",
          )}
          data-chest-celebration-message
        >
          {t(messageKey)}
        </p>
      </div>
    </div>
  );
}
