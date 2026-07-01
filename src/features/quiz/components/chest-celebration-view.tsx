"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
      className="animate-screen-pop flex w-full flex-1 items-center justify-center p-4"
      data-chest-celebration-view
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center transition-all duration-300",
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <div className="relative mb-5 size-28 sm:size-32">
          <Image
            src="/mascots/mascot9.png"
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 640px) 112px, 128px"
            priority
          />
        </div>
        <p
          className={cn(
            "text-balance text-2xl font-bold text-foreground transition-all duration-500 sm:text-3xl",
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
