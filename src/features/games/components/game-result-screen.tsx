"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import type { GameName } from "../game-types";
import { useGameProgressStore } from "../game-progress-store";

interface GameResultScreenProps {
  game: GameName;
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ game, level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const t = useT();
  const { locale } = useLocale();
  const totalPoints = useGameProgressStore((state) => state.getProgress(game).totalPoints);
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("bobble");
  const hasTriggered = useRef(false);

  const basePoints = Math.max(0, totalPoints - points);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    if (success) {
      setBonusPhase("idle");
      const timer = window.setTimeout(() => setBonusPhase("dropping"), 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [success]);

  const handleBonusAnimationEnd = useCallback(() => {
    setBonusPhase("bobble");
  }, []);

  return (
    <div className="animate-screen-pop flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg">
        <Star className="size-5 fill-current" aria-hidden="true" />
        <span className={cn("text-lg font-bold", bonusPhase === "bobble" && "animate-score-bobble")}>
          {formatPoints(locale, bonusPhase === "bobble" ? totalPoints : basePoints)}
        </span>
        {success && bonusPhase === "dropping" ? (
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full text-2xl font-extrabold text-amber-400 animate-celebration-points-drop"
            onAnimationEnd={handleBonusAnimationEnd}
          >
            +{points}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-black text-foreground sm:text-4xl">
          {success ? t("games.completed", { level }) : t("games.failed", { level })}
        </h1>
        {success ? (
          <p className="text-lg font-semibold text-foreground-secondary">{t("games.pointsEarned", { points })}</p>
        ) : null}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className={cn(
            buttonClassName("primary", "lg", "w-full"),
            success ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-red-500 text-white hover:bg-red-600",
          )}
        >
          {success ? t("games.nextLevel") : t("games.tryAgain")}
        </button>

        <Link
          href="/games"
          className={cn(buttonClassName("primary", "lg", "w-full"), "bg-brand text-brand-foreground hover:bg-brand-hover")}
        >
          {t("games.menu")}
        </Link>
      </div>
    </div>
  );
}
