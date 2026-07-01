"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { useAuthSession } from "@/features/auth/auth-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface GameResultScreenProps {
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const t = useT();
  const { user } = useAuthSession();
  const basePoints = user?.profile.aiPracticePoints ?? 0;
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [showGain, setShowGain] = useState(false);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!success || animatedRef.current) {
      setDisplayPoints(basePoints);
      return;
    }

    animatedRef.current = true;
    setDisplayPoints(basePoints);
    setShowGain(true);

    const timer = window.setTimeout(() => {
      setDisplayPoints(basePoints + points);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [basePoints, points, success]);

  return (
    <div className="animate-screen-pop flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-black text-foreground sm:text-4xl">
          {success ? t("games.completed", { level }) : t("games.failed", { level })}
        </h1>

        <div className="relative mt-2 flex flex-col items-center">
          <span className="text-4xl font-black text-brand">{displayPoints}</span>
          {showGain && success ? (
            <span
              className={cn(
                "absolute -right-8 -top-2 text-lg font-bold text-emerald-500",
                displayPoints > basePoints && "animate-points-pop",
              )}
            >
              +{points}
            </span>
          ) : null}
        </div>
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
