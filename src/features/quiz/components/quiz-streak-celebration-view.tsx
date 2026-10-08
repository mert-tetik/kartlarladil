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

const QUIZ_FLOW_TRANSITION_DURATION_MS = 360;
const STREAK_VIDEO_FALLBACK_DURATION_MS = 1_555;
const STREAK_LABEL_REVEAL_RATIO = 0.2;
const POST_VIDEO_HOLD_DURATION_MS = 600;
const DOUBLE_TAP_WINDOW_MS = 320;
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

export function QuizStreakCelebrationView({
  streak,
  enterWithCss = false,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const { locale, t } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const transitionFinishedRef = useRef(false);
  const lastTouchRef = useRef(0);
  const labelTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const fallbackCompletionTimerRef = useRef<number | null>(null);
  const [streakLabelVisible, setStreakLabelVisible] = useState(false);
  const [streakParticles, setStreakParticles] = useState<StreakParticle[]>([]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!streakLabelVisible) return;

    setStreakParticles(
      Array.from({ length: STREAK_PARTICLE_COUNT }, (_, index) => {
        const startXValue = (Math.random() - 0.5) * 240;
        const startYValue = (Math.random() - 0.5) * 52;
        const startX = `${startXValue}px`;
        const startY = `${startYValue}px`;
        const sideWeight = Math.min(1, Math.abs(startXValue) / 120);
        const angle = startXValue < -18
          ? Math.PI + Math.random() * (Math.PI / 2)
          : startXValue > 18
            ? Math.PI * 1.5 + Math.random() * (Math.PI / 2)
            : Math.PI + Math.random() * Math.PI;
        const distance = 58 + sideWeight * 76 + Math.random() * 34;
        const rawX = Math.cos(angle) * distance;
        const x = startXValue < -18
          ? -Math.abs(rawX) * (0.82 + sideWeight * 0.18)
          : startXValue > 18
            ? Math.abs(rawX) * (0.82 + sideWeight * 0.18)
            : rawX;
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
          duration: 620 + Math.round(Math.random() * 220),
          delay: Math.round(Math.random() * 110),
          colorMix:
            Math.random() > 0.5
              ? "color-mix(in srgb, var(--brand) 68%, white)"
              : "color-mix(in srgb, var(--brand) 72%, black)",
        };
      }),
    );
  }, [streakLabelVisible]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (fallbackCompletionTimerRef.current !== null) {
      window.clearTimeout(fallbackCompletionTimerRef.current);
      fallbackCompletionTimerRef.current = null;
    }
    if (labelTimerRef.current !== null) {
      window.clearTimeout(labelTimerRef.current);
      labelTimerRef.current = null;
    }

    videoRef.current?.pause();
    onCompleteRef.current?.();
  }, []);

  const scheduleCompletion = useCallback(() => {
    if (completedRef.current || completionTimerRef.current !== null) return;

    completionTimerRef.current = window.setTimeout(() => {
      completionTimerRef.current = null;
      complete();
    }, POST_VIDEO_HOLD_DURATION_MS);
  }, [complete]);

  const startVideo = useCallback(() => {
    if (completedRef.current || transitionFinishedRef.current) return;
    transitionFinishedRef.current = true;

    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.currentTime = 0;
    video.muted = true;
    playSoundEffect("streak-video-whoosh");
    const playResult = video.play();
    if (typeof playResult?.catch === "function") {
      void playResult.catch(() => undefined);
    }

    labelTimerRef.current = window.setTimeout(() => {
      labelTimerRef.current = null;
      playSoundEffect("streak-count-reveal");
      vibrate("streak-count-reveal");
      setStreakLabelVisible(true);
    }, STREAK_VIDEO_FALLBACK_DURATION_MS * STREAK_LABEL_REVEAL_RATIO);

    fallbackCompletionTimerRef.current = window.setTimeout(
      () => {
        fallbackCompletionTimerRef.current = null;
        scheduleCompletion();
      },
      STREAK_VIDEO_FALLBACK_DURATION_MS + POST_VIDEO_HOLD_DURATION_MS + 250,
    );
  }, [scheduleCompletion]);

  useEffect(() => {
    const transitionTimer = window.setTimeout(
      startVideo,
      QUIZ_FLOW_TRANSITION_DURATION_MS,
    );

    return () => {
      window.clearTimeout(transitionTimer);
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
      if (fallbackCompletionTimerRef.current !== null) {
        window.clearTimeout(fallbackCompletionTimerRef.current);
      }
      if (labelTimerRef.current !== null) {
        window.clearTimeout(labelTimerRef.current);
      }
    };
  }, [startVideo]);

  const handleVideoLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video || transitionFinishedRef.current) return;

    video.pause();
    video.currentTime = 0;
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !transitionFinishedRef.current) return;

    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : STREAK_VIDEO_FALLBACK_DURATION_MS / 1000;

    if (video.currentTime >= duration * STREAK_LABEL_REVEAL_RATIO) {
      if (labelTimerRef.current !== null) {
        window.clearTimeout(labelTimerRef.current);
        labelTimerRef.current = null;
      }
      setStreakLabelVisible(true);
    }
  }, []);

  const handlePointerUp = useCallback((pointerType: string) => {
    if (pointerType !== "touch" && pointerType !== "pen") return;

    const now = performance.now();
    if (now - lastTouchRef.current <= DOUBLE_TAP_WINDOW_MS) {
      complete();
    }
    lastTouchRef.current = now;
  }, [complete]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] overflow-hidden bg-black",
        enterWithCss && "quiz-flow-enter-right",
      )}
      role="button"
      tabIndex={0}
      aria-label={t("quiz.tapToContinue")}
      data-streak-celebration-view
      data-streak-count={streak}
      onPointerUp={(event) => handlePointerUp(event.pointerType)}
      onDoubleClick={complete}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          complete();
        }
      }}
    >
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/quiz/streak-animation.mp4?v=20261007-2"
        muted
        playsInline
        preload="auto"
        onLoadedData={handleVideoLoadedData}
        onTimeUpdate={handleVideoTimeUpdate}
        onEnded={scheduleCompletion}
        aria-hidden="true"
      />
      {streakLabelVisible ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex w-full -translate-y-1/2 justify-center whitespace-nowrap text-center text-5xl font-bold text-brand sm:text-7xl animate-streak-count-label-enter"
          style={{ top: "calc(42% - 30px)" }}
          data-streak-count-label
        >
          <span className="relative z-10 font-super-water">
            {formatSuperWaterText(
              locale,
              t("quiz.streakCount", { count: formatNumber(locale, streak) }),
            )}
          </span>
          <span className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
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
        </div>
      ) : null}
    </div>
  );
}
