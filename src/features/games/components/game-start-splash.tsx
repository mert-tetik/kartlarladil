"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useT } from "@/i18n/locale-provider";
import {
  GAME_LAUNCH_COLORS,
  consumeHandledGameLaunch,
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

const GAME_LAUNCH_TITLE_DURATION_MS = 1500;
const GAME_LAUNCH_DETAILS_DURATION_MS = 2800;
const GAME_LAUNCH_START_DURATION_MS = 3800;
const GAME_LAUNCH_EXIT_DURATION_MS = 4300;

export const GAME_TITLE_KEYS = {
  memory: "games.memory.title",
  wordChallenge: "games.wordChallenge.title",
  wordMatch: "games.wordMatch.title",
} as const;

export type GameLaunchStage = "title" | "details" | "start";

interface GameLaunchCopyProps {
  game: GameName;
  level: number;
  tier: Tier;
  stage: GameLaunchStage;
}

export function GameLaunchCopy({ game, level, tier, stage }: GameLaunchCopyProps) {
  const t = useT();
  const { locale } = useLocale();
  const superWaterFont = canUseSuperWater(locale);

  return (
    <div key={stage} className="animate-game-launch-copy px-6 text-center text-white">
      {stage === "title" ? (
        <span className={cn("block break-words font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t(GAME_TITLE_KEYS[game]))}
        </span>
      ) : stage === "details" ? (
        <div className="flex flex-col items-center gap-3">
          <span className={cn("font-display text-4xl font-bold sm:text-5xl", superWaterFont && "font-super-water")}>
            {formatSuperWaterText(locale, t("games.level", { level }))}
          </span>
          <span className={cn("text-5xl font-bold sm:text-6xl", superWaterFont && "font-super-water")}>{tier}</span>
        </div>
      ) : (
        <span className={cn("block break-words font-display text-6xl font-bold tracking-wider sm:text-7xl lg:text-8xl", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t("games.startSplash"))}
        </span>
      )}
    </div>
  );
}

export function GameStartSplash({ onComplete, onExited, game, level, tier }: GameStartSplashProps) {
  const onCompleteRef = useRef(onComplete);
  const onExitedRef = useRef(onExited);
  const [isHandledGameLaunch] = useState(() => consumeHandledGameLaunch(game));
  const [isGameLaunchSequence] = useState(() => !isHandledGameLaunch && hasPendingGameLaunch(game));
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<GameLaunchStage>("title");

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    if (!mounted) return;

    if (isHandledGameLaunch || !isGameLaunchSequence) {
      onCompleteRef.current();
      onExitedRef.current?.();
      return;
    }

    if (isGameLaunchSequence) {
      consumePendingGameLaunch(game);
    }
  }, [game, isGameLaunchSequence, isHandledGameLaunch, mounted]);

  useEffect(() => {
    if (!mounted || isHandledGameLaunch) return;

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
        onExitedRef.current?.();
      }, GAME_LAUNCH_EXIT_DURATION_MS);

      return () => {
        window.clearTimeout(detailsTimer);
        window.clearTimeout(startTimer);
        window.clearTimeout(completeTimer);
        window.clearTimeout(exitTimer);
      };
    }

    return undefined;
  }, [isGameLaunchSequence, isHandledGameLaunch, mounted]);

  if (typeof document === "undefined" || !mounted || isHandledGameLaunch || !isGameLaunchSequence) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden animate-game-launch-splash"
      data-game-start-splash
      aria-hidden="true"
      style={{ backgroundColor: GAME_LAUNCH_COLORS[game] }}
    >
      <GameLaunchCopy game={game} level={level} tier={tier} stage={stage} />
    </div>,
    document.body,
  );
}
