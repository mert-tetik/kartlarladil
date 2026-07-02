"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, LayoutGrid, RotateCcw, Star } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";

interface GameResultScreenProps {
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const { locale, t } = useLocale();
  const { stats, refreshStats } = useProgressStats();
  const basePoints = stats.totalPoints - points;
  const gainedPoints = points;
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("idle");

  useEffect(() => {
    if (!success || gainedPoints <= 0) return;

    const timer = window.setTimeout(() => {
      setBonusPhase("dropping");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [success, gainedPoints]);

  const handleBonusAnimationEnd = useCallback(() => {
    setBonusPhase("bobble");
    void refreshStats();
  }, [refreshStats]);

  return (
    <div className="animate-screen-pop flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg">
        <Star className="size-5 fill-current" aria-hidden="true" />
        <span
          className={cn(
            "text-lg font-bold",
            bonusPhase === "bobble" && "animate-score-bobble",
          )}
        >
          {formatPoints(locale, bonusPhase === "bobble" ? stats.totalPoints : basePoints)}
        </span>
        {bonusPhase === "dropping" ? (
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full text-2xl font-extrabold text-amber-400 animate-celebration-points-drop"
            onAnimationEnd={handleBonusAnimationEnd}
          >
            +{gainedPoints}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-black text-foreground sm:text-4xl">
          {success ? t("games.completed", { level }) : t("games.failed", { level })}
        </h1>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className={cn(
            buttonClassName("primary", "lg", "w-full"),
            "inline-flex items-center justify-center gap-2",
            success ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-red-500 text-white hover:bg-red-600",
          )}
        >
          {success ? <ArrowRight className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
          {success ? t("games.nextLevel") : t("games.tryAgain")}
        </button>

        <Link
          href="/games"
          className={cn(
            buttonClassName("primary", "lg", "w-full"),
            "inline-flex items-center justify-center gap-2 bg-brand text-brand-foreground hover:bg-brand-hover",
          )}
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          {t("games.menu")}
        </Link>
      </div>
    </div>
  );
}
