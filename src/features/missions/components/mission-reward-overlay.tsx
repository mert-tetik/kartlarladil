"use client";

import { useEffect, useRef, useState } from "react";

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

export function MissionRewardOverlay({ mode, onComplete }: MissionRewardOverlayProps) {
  const { stats } = useProgressStats();

  if (!mode) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {mode.kind === "chest" ? (
        <ChestOpeningView tier={mode.tier} totalPoints={stats.totalPoints} onComplete={onComplete} />
      ) : (
        <MissionPointsCelebration amount={mode.amount} totalPoints={stats.totalPoints} onComplete={onComplete} />
      )}
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
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col items-center justify-center rounded-lg border border-border bg-background-card p-4 text-center sm:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-0">
      <h2 className="text-2xl font-semibold text-foreground">{t("missions.rewardClaimed")}</h2>
      <p className="mt-1 text-sm text-foreground-secondary">{t("missions.pointsRewardDescription")}</p>

      <div className="relative mt-8 flex items-center justify-center">
        <div className="relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-white shadow-lg">
          <Star className="size-6 fill-current" aria-hidden="true" />
          <span
            className={cn(
              "text-2xl font-bold",
              bonusPhase === "bobble" && "animate-score-bobble",
            )}
          >
            {formatPoints(locale, displayPoints)}
          </span>
          {bonusPhase === "dropping" ? (
            <span
              className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 text-3xl font-bold text-amber-400 animate-celebration-points-fall"
              onAnimationEnd={handleAnimationEnd}
            >
              +{amount}
            </span>
          ) : null}
        </div>
      </div>

      {bonusPhase === "bobble" ? (
        <p className="mt-6 text-lg font-bold text-emerald-500">+{amount} {t("common.points")}</p>
      ) : null}
    </div>
  );
}
