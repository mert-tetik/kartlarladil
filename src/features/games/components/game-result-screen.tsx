"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { useProgressStats } from "@/features/progress/progress-client";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardProgressGemRewardAction } from "@/features/gems/gem-actions";
import type { GameName } from "../game-types";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import { useLocale } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
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

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

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
              onClick={() => openLeaderboard()}
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

        <MainPointsDisplay
          targetRef={scoreRef}
          pulse={scorePulse}
          className="game-result-score px-4 py-2"
          valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
          value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
        />
        <RewardGemHud balances={gemDisplayBalances} pulse={gemPulse} animate />
      </div>
      <RewardScatter
        points={success && gainedPoints > 0 ? {
          amount: gainedPoints,
          source: rewardSourceRef,
          target: scoreRef,
          startDelayMs: 1_550,
          placement: { origin: "random", spreadX: 0.56, spreadY: 0.56 },
          zIndex: 60,
        } : null}
        gems={{
          rewards: gemRewards,
          source: rewardSourceRef,
          startDelayMs: 1_550,
          placement: { origin: "random", spreadX: 0.55, spreadY: 0.35 },
          zIndex: 112,
        }}
        onPointsArrive={(awardedTotal, arrivalIndex) => {
          setDisplayPoints(basePoints + awardedTotal);
          setScorePulse(arrivalIndex);
        }}
        onPointsComplete={() => void refreshStats()}
        onGemArrive={handleGemArrive}
        onGemsComplete={() => {
          finishGemRewardDisplay(gemFinalBalancesRef.current);
          void refreshProfile();
        }}
      />
    </div>
  );
}
