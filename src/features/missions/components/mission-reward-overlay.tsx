"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";

interface MissionRewardOverlayProps {
  mode: { kind: "chest"; tier: ChestTierDefinition } | { kind: "points"; amount: number } | null;
  onComplete: () => void;
}

const EXIT_DURATION_MS = 300;

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
        "fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md transition-opacity duration-300",
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
          "relative flex h-full w-full items-center justify-center transition-all duration-300",
          exiting ? "scale-[0.98] opacity-0" : "scale-100 opacity-100",
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
  const t = useT();
  const { locale } = useLocale();
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("idle");
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const dropTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const bonusCompletedRef = useRef(false);

  useEffect(() => {
    playSoundEffect("points");
    vibrate("confetti");

    dropTimerRef.current = window.setTimeout(() => {
      setBonusPhase("dropping");
    }, 560);

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
    }, 1000);
  }

  return (
    <div
      data-mission-points-celebration
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <div className="relative flex h-full w-full max-w-5xl flex-1 flex-col">
        <div className="flex justify-center pt-1 sm:pt-2">
          <div
            data-mission-total-points-shell
            className="rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg sm:px-5"
          >
            <div className="relative flex items-center gap-2">
              <Star className="size-5 fill-current" aria-hidden="true" />
              <span
                data-mission-total-points
                className={cn(
                  "text-lg font-bold sm:text-xl",
                  bonusPhase === "bobble" && "animate-score-bobble",
                )}
              >
                {formatPoints(locale, displayPoints)}
              </span>
              {bonusPhase === "dropping" ? (
                <span
                  className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-3xl font-bold text-amber-400 animate-celebration-points-fall"
                  onAnimationEnd={handleAnimationEnd}
                >
                  +{amount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-12">
          <div className="w-full max-w-xl rounded-[2rem] border border-border/70 bg-background-card/95 px-6 py-10 shadow-2xl backdrop-blur-sm sm:px-8 sm:py-12">
            <div className="mx-auto flex max-w-md flex-col items-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500">
                <Star className="size-8 fill-current" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                {t("missions.rewardClaimed")}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-foreground-secondary sm:text-base">
                {t("missions.pointsRewardDescription")}
              </p>
              {bonusPhase === "bobble" ? (
                <p className="mt-6 text-xl font-bold text-emerald-500">
                  +{amount} {t("common.points")}
                </p>
              ) : (
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  {t("missions.reward.points", { count: amount })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
