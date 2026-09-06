"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { ScoreIcon } from "@/components/score-icon";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { useProgressStats } from "@/features/progress/progress-client";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardProgressGemRewardAction } from "@/features/gems/gem-actions";
import type { GameName } from "../game-types";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { useLocale } from "@/i18n/locale-provider";
import { formatNumber, formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { vibrate } from "@/lib/vibration";
import { GAME_BACKGROUND_SOURCES } from "./game-shell";

interface GameResultScreenProps {
  game: GameName;
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

export function GameResultScreen({ game, level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const { locale, t } = useLocale();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const router = useRouter();
  const { stats, refreshStats } = useProgressStats();
  const { openLeaderboard } = useLeaderboardOverlay();
  const { data: leaderboardData } = useLeaderboardData({ refreshOnMount: true });
  const basePoints = stats.totalPoints - points;
  const gainedPoints = points;
  const scoreRef = useRef<HTMLSpanElement>(null);
  const rewardSourceRef = useRef<HTMLDivElement>(null);
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<Array<{ id: number; startX: number; startY: number; scatterX: number; scatterY: number; targetX: number; targetY: number; delay: number }>>([]);
  const [isExiting, setIsExiting] = useState(false);
  const [gemRewards, setGemRewards] = useState<GemRewards>([]);
  const gemFinalBalancesRef = useRef<GemBalances | null>(null);
  const {
    balances: gemDisplayBalances,
    pulse: gemPulse,
    prepare: prepareGemRewardDisplay,
    handleGemArrive,
    finish: finishGemRewardDisplay,
  } = useGemRewardDisplay();
  const [gemClaimKey] = useState(
    () => `game-level:${game}:${level}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
  );
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!success || !user) return;
    let active = true;

    void awardProgressGemRewardAction({
      source: "game-level",
      claimKey: gemClaimKey,
      level,
    }).then((result) => {
      if (!active || !result.success) return;
      const rewards = result.awarded ? result.rewards ?? [] : [];
      if (result.balances) {
        gemFinalBalancesRef.current = result.balances;
        prepareGemRewardDisplay(result.balances, rewards);
        updateProfileField({
          blueGems: result.balances.blue,
          greenGems: result.balances.green,
          purpleGems: result.balances.purple,
        });
      }
      if (result.awarded && result.rewards?.length) setGemRewards(result.rewards);
    });

    return () => {
      active = false;
    };
  }, [gemClaimKey, level, prepareGemRewardDisplay, success, updateProfileField, user]);

  useLayoutEffect(() => {
    if (!success || gainedPoints <= 0 || !scoreRef.current || !rewardSourceRef.current) return;
    const source = rewardSourceRef.current.getBoundingClientRect();
    const target = scoreRef.current.getBoundingClientRect();
    const count = getScoreFlightIconCount(gainedPoints);
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
    setDisplayPoints(
      basePoints + getScoreFlightAwardAtArrival(gainedPoints, flightIcons.length, index),
    );
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
  const leaderboardStanding = leaderboardData
    ? t("leaderboard.yourStanding", {
        position: formatNumber(locale, leaderboardData.viewer.position),
      })
    : t("leaderboard.positionLoading");

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
        <div ref={rewardSourceRef} className="flex flex-col items-center gap-3">
          {success ? (
            <p
              data-game-result-standing
              className={cn(
                "game-result-title-success bg-gradient-to-r from-[var(--score-highlight)] via-[var(--score-highlight)] to-[var(--score-end)] bg-clip-text text-[2.6rem] font-bold leading-none text-transparent drop-shadow-[0_2px_3px_rgba(15,23,42,0.55)] sm:text-5xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {canUseSuperWater(locale)
                ? formatSuperWaterText(locale, leaderboardStanding)
                : leaderboardStanding}
            </p>
          ) : null}
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

        <div className="flex items-center justify-center gap-4">
          {success ? (
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.leaderboard}
              imageSizes="56px"
              onClick={openLeaderboard}
              aria-label={t("leaderboard.title")}
              data-game-result-action="leaderboard"
              className="game-result-action-leaderboard size-14"
            />
          ) : null}
          <ImageActionButton
            imageSrc={success ? RESULT_BUTTON_IMAGES.play : RESULT_BUTTON_IMAGES.replay}
            imageSizes="64px"
            onClick={() => handleExit(onPrimary)}
            aria-label={success ? t("games.nextLevel") : t("games.tryAgain")}
            data-game-result-action={success ? "play" : "replay"}
            className="game-result-action-primary size-16"
          />
          <ImageActionButton
            imageSrc={RESULT_BUTTON_IMAGES.menu}
            imageSizes="56px"
            onClick={() => handleExit(() => router.push("/games"))}
            aria-label={t("games.menu")}
            data-game-result-action="menu"
            className="game-result-action-menu size-14"
          />
        </div>

        <div className="game-result-score relative flex items-center gap-2 rounded-full border border-[var(--score-highlight)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-white shadow-lg">
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
        <RewardGemHud balances={gemDisplayBalances} pulse={gemPulse} animate />
      </div>
      {flightIcons.length > 0 ? createPortal(flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[60] animate-quiz-score-icon-flight" style={{ "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`, "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`, "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`, animationDelay: `${icon.delay}ms` } as CSSProperties} onAnimationEnd={() => handleFlightEnd(icon.id)}><ScoreIcon size={32} /></span>
      )), document.body) : null}
      <GemRewardFlight
        key={gemRewards.map((item) => `${item.type}-${item.amount}`).join("|") || "no-gem-reward"}
        rewards={gemRewards}
        sourceRef={rewardSourceRef}
        startDelayMs={1_550}
        onGemArrive={handleGemArrive}
        onComplete={() => {
          finishGemRewardDisplay(gemFinalBalancesRef.current);
          void refreshProfile();
        }}
      />
    </div>
  );
}
