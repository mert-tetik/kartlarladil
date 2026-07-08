"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";

interface MissionRewardOverlayProps {
  mode: { kind: "chest"; tier: ChestTierDefinition } | { kind: "points"; amount: number } | null;
  onComplete: () => void;
}

const EXIT_DURATION_MS = 500;
const POINT_DROP_DELAY_MS = 220;
const POINT_CLOSE_DELAY_MS = 90;

export function MissionRewardOverlay({ mode, onComplete }: MissionRewardOverlayProps) {
  const { stats } = useProgressStats();
  const [activeMode, setActiveMode] = useState(mode);
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
      setExiting(false);
      return;
    }

    setActiveMode(null);
    setExiting(false);
  }, [mode]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleChildComplete = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }

    setExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setActiveMode(null);
      setExiting(false);
      onComplete();
    }, EXIT_DURATION_MS);
  }, [onComplete]);

  if (!activeMode) {
    return null;
  }

  return (
    <div
      data-mission-reward-overlay
      data-state={exiting ? "closing" : "open"}
      className={cn(
        "animate-screen-pop fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        exiting ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.14),_transparent_34%)]" />
      </div>

      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          exiting ? "scale-[0.985] opacity-0" : "scale-100 opacity-100",
        )}
      >
        {activeMode.kind === "chest" ? (
          <ChestOpeningView
            tier={activeMode.tier}
            totalPoints={stats.totalPoints}
            onComplete={handleChildComplete}
          />
        ) : (
          <MissionPointsCelebration
            amount={activeMode.amount}
            totalPoints={stats.totalPoints}
            onComplete={handleChildComplete}
          />
        )}
      </div>
    </div>
  );
}

function MissionPointsCelebration({
  amount,
  totalPoints,
  onComplete,
}: {
  amount: number;
  totalPoints: number;
  onComplete: () => void;
}) {
  const { locale } = useLocale();
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("idle");
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const dropTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const bonusCompletedRef = useRef(false);

  useEffect(() => {
    playSoundEffect("mission-claim");
    vibrate("confetti");

    dropTimerRef.current = window.setTimeout(() => {
      setBonusPhase("dropping");
    }, POINT_DROP_DELAY_MS);

    return () => {
      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function handleAnimationEnd() {
    if (bonusCompletedRef.current) {
      return;
    }

    bonusCompletedRef.current = true;
    setDisplayPoints(totalPoints + amount);
    setBonusPhase("bobble");

    closeTimerRef.current = window.setTimeout(() => {
      onComplete();
    }, POINT_CLOSE_DELAY_MS);
  }

  return (
    <div
      data-mission-points-celebration
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-85" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_30%)]" />
      </div>

      <div className="relative flex items-center justify-center">
        <div
          data-mission-total-points-shell
          className="relative flex min-w-[min(84vw,20rem)] items-center justify-center gap-3 rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-5 text-white shadow-[0_18px_48px_rgba(245,158,11,0.24)] sm:min-w-[22rem] sm:px-10 sm:py-6"
        >
          <Star className="size-7 fill-current sm:size-8" aria-hidden="true" />
          <span
            data-mission-total-points
            className={cn(
              "text-4xl font-bold tracking-tight sm:text-5xl",
              bonusPhase === "bobble" && "animate-score-bobble",
            )}
          >
            {formatPoints(locale, displayPoints)}
          </span>
          {bonusPhase === "dropping" ? (
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-amber-100 drop-shadow-[0_10px_30px_rgba(255,255,255,0.25)] animate-celebration-points-fall sm:text-5xl"
              onAnimationEnd={handleAnimationEnd}
            >
              +{amount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
