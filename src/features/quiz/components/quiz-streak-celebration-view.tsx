"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

interface QuizStreakCelebrationViewProps {
  streak: number;
  enterWithCss?: boolean;
  onPress?: () => void;
  rewardPoints?: number;
  totalPoints?: number;
  gemRewards?: GemRewards;
  gemBalances?: GemBalances | null;
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
  onPress,
  rewardPoints = 0,
  totalPoints = 0,
  gemRewards = [],
  gemBalances = null,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const { locale, t } = useLocale();
  const onPressRef = useRef(onPress);
  const onCompleteRef = useRef(onComplete);
  const rewardSourceRef = useRef<HTMLDivElement>(null);
  const rewardTargetRef = useRef<HTMLSpanElement>(null);
  const completedRef = useRef(false);
  const pressedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const completionFrameRef = useRef<number | null>(null);
  const pointsCompleteRef = useRef(false);
  // Gem rewards are optional background data. Until a gem scatter is actually
  // supplied, it must not block the point scatter or the screen transition.
  const gemsCompleteRef = useRef(true);
  const [isPressed, setIsPressed] = useState(false);
  const [streakParticles, setStreakParticles] = useState<StreakParticle[]>([]);
  const [rewardStarted, setRewardStarted] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const hasPointReward = rewardPoints > 0;
  const {
    balances: gemDisplayBalances,
    pulse: gemPulse,
    prepare: prepareGemRewardDisplay,
    handleGemArrive,
    finish: finishGemRewardDisplay,
  } = useGemRewardDisplay();

  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (gemBalances) {
      prepareGemRewardDisplay(gemBalances, gemRewards);
    }
  }, [gemBalances, gemRewards, prepareGemRewardDisplay]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    onCompleteRef.current?.();
  }, []);

  const cancelScheduledCompletion = useCallback(() => {
    if (completionFrameRef.current !== null) {
      window.cancelAnimationFrame(completionFrameRef.current);
      completionFrameRef.current = null;
    }
  }, []);

  const scheduleCompletionAfterPaint = useCallback(() => {
    if (completionFrameRef.current !== null || completedRef.current) return;

    completionFrameRef.current = window.requestAnimationFrame(() => {
      completionFrameRef.current = window.requestAnimationFrame(() => {
        completionFrameRef.current = null;
        complete();
      });
    });
  }, [complete]);

  const maybeCompleteScatter = useCallback(() => {
    if (!pointsCompleteRef.current || !gemsCompleteRef.current) return;
    scheduleCompletionAfterPaint();
  }, [scheduleCompletionAfterPaint]);

  useEffect(() => {
    if (!rewardStarted || completedRef.current) return;

    // If the background claim resolves while this view is still open, include
    // its flights in the visual completion barrier. If it resolves later, it
    // remains a background profile update and cannot hold the quiz flow open.
    gemsCompleteRef.current = gemRewards.length === 0;
    if (!gemsCompleteRef.current) cancelScheduledCompletion();
    maybeCompleteScatter();
  }, [cancelScheduledCompletion, gemRewards.length, maybeCompleteScatter, rewardStarted]);

  const handlePress = useCallback(() => {
    if (pressedRef.current || completedRef.current) return;
    pressedRef.current = true;
    setIsPressed(true);
    setStreakParticles(createStreakParticles());
    pointsCompleteRef.current = !hasPointReward;
    gemsCompleteRef.current = true;
    if (hasPointReward || gemRewards.length > 0) {
      setRewardStarted(true);
    } else {
      completionTimerRef.current = window.setTimeout(complete, STREAK_EXIT_DELAY_MS);
    }
    playSoundEffect("streak-count-reveal");
    vibrate("streak-reward-tap");
    onPressRef.current?.();
  }, [gemRewards.length, hasPointReward]);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
      cancelScheduledCompletion();
    };
  }, [cancelScheduledCompletion]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-background px-4",
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
      {hasPointReward || gemRewards.length > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-5 z-10 -translate-x-1/2 sm:top-8",
            rewardStarted ? "animate-streak-reward-hud-enter" : "opacity-0",
          )}
          data-streak-reward-points
        >
          <MainPointsDisplay
            targetRef={rewardTargetRef}
            pulse={scorePulse}
            className="text-center"
            valueClassName="text-lg font-bold"
            value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
          />
          <div className="mt-2 flex justify-center">
            <RewardGemHud
              balances={gemDisplayBalances}
              pulse={gemPulse}
              animate
              desktopVisible
              superWater={false}
              hudRole="reward"
            />
          </div>
        </div>
      ) : null}
      <div ref={rewardSourceRef} className="relative flex items-center justify-center">
        <div
          className={cn(
            "relative flex items-center justify-center whitespace-nowrap text-center text-5xl font-bold text-brand sm:text-7xl",
            isPressed ? "animate-streak-count-exit" : "animate-streak-count-idle",
          )}
          data-streak-count-label
          data-streak-count-state={isPressed ? "exiting" : "visible"}
        >
          <span className="relative z-10 font-super-water">
            {formatSuperWaterText(
              locale,
              t("quiz.streakCount", { count: formatNumber(locale, streak) }),
            )}
          </span>
        </div>
      </div>
      {rewardStarted ? (
        <RewardScatter
          points={{
            amount: rewardPoints,
            source: rewardSourceRef,
            target: rewardTargetRef,
            placement: { origin: "random", spreadX: 0.58, spreadY: 0.5 },
            zIndex: 71,
          }}
          onPointsArrive={(awardedTotal, arrivalIndex) => {
            setDisplayPoints(totalPoints + awardedTotal);
            setScorePulse(arrivalIndex);
          }}
          onPointsComplete={() => {
            pointsCompleteRef.current = true;
            maybeCompleteScatter();
          }}
          gems={
            gemRewards.length > 0
              ? {
                  rewards: gemRewards,
                  source: rewardSourceRef,
                  targetSelector: '[data-reward-gem-hud-role="reward"] [data-reward-gem-target]',
                  placement: { origin: "random", spreadX: 0.55, spreadY: 0.35 },
                  zIndex: 72,
                }
              : null
          }
          onGemArrive={handleGemArrive}
          onGemsComplete={() => {
            gemsCompleteRef.current = true;
            finishGemRewardDisplay(gemBalances);
            maybeCompleteScatter();
          }}
        />
      ) : null}
    </div>
  );
}
