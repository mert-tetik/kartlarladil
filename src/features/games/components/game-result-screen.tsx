"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, Play, RotateCcw, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { vibrate } from "@/lib/vibration";
import { GAME_BACKGROUND_SOURCES } from "./game-shell";

interface GameResultScreenProps {
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const { stats, refreshStats } = useProgressStats();
  const basePoints = stats.totalPoints - points;
  const gainedPoints = points;
  const scoreRef = useRef<HTMLSpanElement>(null);
  const rewardSourceRef = useRef<HTMLDivElement>(null);
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<Array<{ id: number; startX: number; startY: number; scatterX: number; scatterY: number; targetX: number; targetY: number; delay: number }>>([]);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!success || gainedPoints <= 0 || !scoreRef.current || !rewardSourceRef.current) return;
    const source = rewardSourceRef.current.getBoundingClientRect();
    const target = scoreRef.current.getBoundingClientRect();
    const count = Math.min(Math.ceil(gainedPoints / 2), 25);
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    const startTimer = window.setTimeout(() => {
      const icons = Array.from({ length: count }, (_, index) => ({
        id: index,
        startX: source.left + source.width * (0.22 + Math.random() * 0.56),
        startY: source.top + source.height * (0.22 + Math.random() * 0.56),
        scatterX: (Math.random() - 0.5) * 150,
        scatterY: -35 - Math.random() * 100,
        targetX,
        targetY,
        delay: Math.round((count === 1 ? 0 : index / (count - 1)) * 780),
      }));
      setFlightIcons(icons);
    }, 1_550);
    return () => {
      window.clearTimeout(startTimer);
    };
  }, [gainedPoints, success]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  function handleFlightEnd(id: number) {
    const index = id + 1;
    setDisplayPoints(basePoints + Math.min(gainedPoints, index * 2));
    setScorePulse(index);
    playSoundEffect("points");
    vibrate("tap");
    if (index === flightIcons.length) {
      void refreshStats();
    }
  }

  function handleExit(complete: () => void) {
    if (isExiting) return;

    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(complete, 460);
  }

  const resultTitle = success
    ? t("games.completed", { level })
    : t("games.failed", { level });

  return (
    <div
      className={cn(
        "game-result-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden p-6 text-center",
        isExiting && "game-result-overlay-exit pointer-events-none",
      )}
    >
      <div
        aria-hidden="true"
        className="game-result-background absolute inset-0"
        style={{
          backgroundImage: success
            ? `linear-gradient(rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.1)), url(${GAME_BACKGROUND_SOURCES.levelComplete})`
            : `linear-gradient(rgb(15 23 42 / 0.28), rgb(15 23 42 / 0.28)), url(${GAME_BACKGROUND_SOURCES.levelFailed})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7">
        <div ref={rewardSourceRef} className="flex flex-col items-center">
          <h1
            className={cn(
              "game-result-title text-5xl font-bold leading-none sm:text-6xl",
              success ? "game-result-title-success text-white" : "text-white",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterText(locale, resultTitle)}
          </h1>
        </div>

        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => handleExit(onPrimary)}
            className="game-result-action-primary inline-flex size-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-105 hover:bg-emerald-600 active:scale-95"
            aria-label={success ? t("games.nextLevel") : t("games.tryAgain")}
          >
            {success ? (
              <Play className="size-10 fill-current" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <RotateCcw className="size-10" strokeWidth={3} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleExit(() => router.push("/games"))}
            className="game-result-action-menu inline-flex size-20 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-transform hover:scale-105 hover:bg-red-600 active:scale-95"
            aria-label={t("games.menu")}
          >
            <LayoutGrid className="size-9 fill-current" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className="game-result-score relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg">
          <Star className="size-5 fill-current" aria-hidden="true" />
          <span
            className={cn(
              "text-lg font-bold",
              scorePulse > 0 && "animate-score-bobble",
            )}
            key={scorePulse}
            ref={scoreRef}
          >
            {formatPoints(locale, displayPoints)}
          </span>
        </div>
      </div>
      {flightIcons.length > 0 ? createPortal(flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[60] animate-quiz-score-icon-flight" style={{ "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`, "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`, "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`, animationDelay: `${icon.delay}ms` } as CSSProperties} onAnimationEnd={() => handleFlightEnd(icon.id)}><ScoreIcon size={32} /></span>
      )), document.body) : null}
    </div>
  );
}
