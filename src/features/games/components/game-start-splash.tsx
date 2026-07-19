"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useT } from "@/i18n/locale-provider";
import {
  GAME_LAUNCH_COLORS,
  consumePendingGameLaunch,
  hasPendingGameLaunch,
} from "@/features/games/game-launch-transition";
import type { GameName } from "@/features/games/game-types";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { Tier } from "@/types/domain";

interface GameStartSplashProps {
  onComplete: () => void;
  onExited?: () => void;
  game: GameName;
  level: number;
  tier: Tier;
}

const SPLASH_REVEAL_DURATION_MS = 720;
const SPLASH_EXIT_DURATION_MS = 1200;
const GAME_LAUNCH_TITLE_DURATION_MS = 1500;
const GAME_LAUNCH_DETAILS_DURATION_MS = 2800;
const GAME_LAUNCH_START_DURATION_MS = 3800;
const GAME_LAUNCH_EXIT_DURATION_MS = 4300;

const GAME_TITLE_KEYS = {
  memory: "games.memory.title",
  wordChallenge: "games.wordChallenge.title",
  wordMatch: "games.wordMatch.title",
} as const;

export function GameStartSplash({ onComplete, onExited, game, level, tier }: GameStartSplashProps) {
  const t = useT();
  const { locale } = useLocale();
  const onCompleteRef = useRef(onComplete);
  const onExitedRef = useRef(onExited);
  const [isGameLaunchSequence] = useState(() => hasPendingGameLaunch(game));
  const [stage, setStage] = useState<"title" | "details" | "start">("title");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    if (isGameLaunchSequence) {
      consumePendingGameLaunch(game);
    }
  }, [game, isGameLaunchSequence]);

  useEffect(() => {
    if (isGameLaunchSequence) {
      const detailsTimer = window.setTimeout(
        () => setStage("details"),
        GAME_LAUNCH_TITLE_DURATION_MS,
      );
      const startTimer = window.setTimeout(
        () => setStage("start"),
        GAME_LAUNCH_DETAILS_DURATION_MS,
      );
      const completeTimer = window.setTimeout(() => {
        onCompleteRef.current();
      }, GAME_LAUNCH_START_DURATION_MS);
      const exitTimer = window.setTimeout(() => {
        setExiting(true);
        onExitedRef.current?.();
      }, GAME_LAUNCH_EXIT_DURATION_MS);

      return () => {
        window.clearTimeout(detailsTimer);
        window.clearTimeout(startTimer);
        window.clearTimeout(completeTimer);
        window.clearTimeout(exitTimer);
      };
    }

    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, SPLASH_REVEAL_DURATION_MS);

    const exitTimer = window.setTimeout(() => {
      setExiting(true);
      onExitedRef.current?.();
    }, SPLASH_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(completeTimer);
      window.clearTimeout(exitTimer);
    };
  }, [isGameLaunchSequence]);

  if (exiting || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={isGameLaunchSequence
        ? "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden animate-game-launch-splash"
        : "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-brand animate-quiz-start-splash"}
      data-game-start-splash
      aria-hidden="true"
      style={isGameLaunchSequence ? { backgroundColor: GAME_LAUNCH_COLORS[game] } : undefined}
    >
      {isGameLaunchSequence ? (
        <div key={stage} className="animate-game-launch-copy px-6 text-center text-white">
          {stage === "title" ? (
            <span className={cn("block break-words font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t(GAME_TITLE_KEYS[game]))}
            </span>
          ) : stage === "details" ? (
            <div className="flex flex-col items-center gap-3">
              <span className={cn("font-display text-4xl font-bold sm:text-5xl", canUseSuperWater(locale) && "font-super-water")}>
                {formatSuperWaterText(locale, t("games.level", { level }))}
              </span>
              <span className={cn("text-5xl font-bold sm:text-6xl", canUseSuperWater(locale) && "font-super-water")}>{tier}</span>
            </div>
          ) : (
            <span className={cn("block break-words font-display text-6xl font-bold tracking-wider sm:text-7xl lg:text-8xl", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("games.startSplash"))}
            </span>
          )}
        </div>
      ) : (
        <span className={cn("break-words px-6 text-center text-5xl font-bold uppercase tracking-wider text-white sm:text-6xl lg:text-7xl", canUseSuperWater(locale) && "font-super-water")}>
          {formatSuperWaterText(locale, t("games.startSplash"))}
        </span>
      )}
    </div>,
    document.body,
  );
}
