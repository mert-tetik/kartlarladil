"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

interface QuizStreakCelebrationViewProps {
  streak: number;
  enterWithCss?: boolean;
  onComplete?: () => void;
}

const STREAK_EXIT_DELAY_MS = 700;
const STREAK_PARTICLE_COUNT = 24;

type StreakParticle = {
  startX: string;
  startY: string;
  x: number;
  y: number;
  rotation: number;
  midX: number;
  midY: number;
  midRotation: number;
  size: number;
  duration: number;
  delay: number;
  colorMix: string;
};

function createStreakParticles(): StreakParticle[] {
  return Array.from({ length: STREAK_PARTICLE_COUNT }, () => {
    const startXValue = (Math.random() - 0.5) * 220;
    const startYValue = (Math.random() - 0.5) * 64;
    const startX = `${startXValue}px`;
    const startY = `${startYValue}px`;
    const angle = Math.random() * Math.PI * 2;
    const distance = 130 + Math.random() * 190;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const rotation = (Math.random() - 0.5) * 260;

    return {
      startX,
      startY,
      x,
      y,
      rotation,
      midX: startXValue + (x - startXValue) * 0.42,
      midY: startYValue + (y - startYValue) * 0.42,
      midRotation: rotation * 0.42,
      size: 8 + Math.round(Math.random() * 7),
      duration: 290 + Math.round(Math.random() * 130),
      delay: Math.round(Math.random() * 55),
      colorMix:
        Math.random() > 0.5
          ? "color-mix(in srgb, var(--brand) 68%, white)"
          : "color-mix(in srgb, var(--brand) 72%, black)",
    };
  });
}

export function QuizStreakCelebrationView({
  streak,
  enterWithCss = false,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const { locale, t } = useLocale();
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const pressedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [streakParticles, setStreakParticles] = useState<StreakParticle[]>([]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    onCompleteRef.current?.();
  }, []);

  const handlePress = useCallback(() => {
    if (pressedRef.current || completedRef.current) return;
    pressedRef.current = true;
    setIsPressed(true);
    setStreakParticles(createStreakParticles());
    playSoundEffect("streak-count-reveal");
    vibrate("streak-reward-tap");
    completionTimerRef.current = window.setTimeout(complete, STREAK_EXIT_DELAY_MS);
  }, [complete]);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black px-4",
        enterWithCss && "quiz-flow-enter-right",
      )}
      role="button"
      tabIndex={0}
      aria-label={t("quiz.tapToContinue")}
      data-no-tap-vibrate
      data-streak-celebration-view
      data-streak-count={streak}
      onPointerUp={handlePress}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePress();
        }
      }}
    >
      {streakParticles.length > 0 ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 block size-0"
          data-streak-particle-layer
          aria-hidden="true"
        >
          {streakParticles.map((particle, index) => (
            <span
              key={index}
              className="streak-count-particle absolute left-1/2 top-1/2 block rounded-[2px]"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.colorMix,
                animationDuration: `${particle.duration}ms`,
                animationDelay: `${particle.delay}ms`,
                "--particle-x": `${particle.x}px`,
                "--particle-y": `${particle.y}px`,
                "--particle-rotation": `${particle.rotation}deg`,
                "--particle-start-x": particle.startX,
                "--particle-start-y": particle.startY,
                "--particle-mid-x": `${particle.midX}px`,
                "--particle-mid-y": `${particle.midY}px`,
                "--particle-mid-rotation": `${particle.midRotation}deg`,
              } as CSSProperties}
            />
          ))}
        </span>
      ) : null}
      <div
        className={cn(
          "relative flex items-center justify-center whitespace-nowrap text-center text-5xl font-bold text-brand sm:text-7xl",
          isPressed ? "animate-streak-count-exit" : "animate-streak-count-idle",
        )}
        data-streak-count-label
        >
        <span className="relative z-10 font-super-water">
          {formatSuperWaterText(
            locale,
            t("quiz.streakCount", { count: formatNumber(locale, streak) }),
          )}
        </span>
      </div>
    </div>
  );
}
