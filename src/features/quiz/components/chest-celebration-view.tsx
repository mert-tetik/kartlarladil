"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";

interface ChestCelebrationViewProps {
  onComplete: () => void;
}

const CELEBRATION_MESSAGE_KEYS = [
  "quiz.chestCelebration1",
  "quiz.chestCelebration2",
  "quiz.chestCelebration3",
  "quiz.chestCelebration4",
] as const satisfies readonly string[];

const CELEBRATION_ENTER_DELAY_MS = 50;
const CELEBRATION_MESSAGE_DELAY_MS = 1000;
const CELEBRATION_COMPLETE_DELAY_MS = 300;

export function ChestCelebrationView({ onComplete }: ChestCelebrationViewProps) {
  const { locale, t } = useLocale();
  const [viewVisible, setViewVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messageKey] = useState(() =>
    CELEBRATION_MESSAGE_KEYS[Math.floor(Math.random() * CELEBRATION_MESSAGE_KEYS.length)],
  );
  const completeRef = useRef(onComplete);
  const finishedRef = useRef(false);
  const messageTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const finishVideo = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setMessageVisible(true);
    messageTimerRef.current = window.setTimeout(() => {
      setMessageVisible(false);
      setClosing(true);
      completeTimerRef.current = window.setTimeout(
        () => completeRef.current?.(),
        CELEBRATION_COMPLETE_DELAY_MS,
      );
    }, CELEBRATION_MESSAGE_DELAY_MS);
  };

  useEffect(() => {
    const enterTimer = window.setTimeout(
      () => setViewVisible(true),
      CELEBRATION_ENTER_DELAY_MS,
    );

    return () => {
      window.clearTimeout(enterTimer);
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--background)] p-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        closing
          ? "scale-[1.025] opacity-0"
          : viewVisible
            ? "scale-100 opacity-100"
            : "scale-[1.025] opacity-100",
      )}
      data-chest-celebration-view
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--background)]"
        aria-hidden="true"
        data-chest-celebration-background
      >
        <video
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ease-linear",
            viewVisible ? "opacity-100" : "opacity-0",
          )}
          src="/quiz/result_message_video.mp4"
          autoPlay
          muted
          onEnded={finishVideo}
          onError={finishVideo}
          playsInline
          preload="auto"
          data-chest-celebration-video
        />
      </div>
      <div
        className={cn(
          "relative z-10 flex max-w-[22rem] items-center justify-center text-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-xl",
          messageVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-6 scale-95 opacity-0",
        )}
      >
        <p
          className={cn(
            "text-balance text-4xl font-bold uppercase leading-tight text-white [filter:grayscale(1)_brightness(0)_invert(1)] sm:text-6xl",
            canUseSuperWater(locale) && "font-super-water",
            messageVisible && "animate-pulse",
          )}
          data-chest-celebration-message
        >
          {formatSuperWaterUppercaseText(locale, t(messageKey))}
        </p>
      </div>
    </div>
  );
}
