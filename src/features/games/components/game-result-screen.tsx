"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
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
import { playSoundEffect } from "@/lib/sound-effects";
import { createCompletionParticles } from "@/lib/quiz-completion-particles";

interface GameResultScreenProps {
  game: GameName;
  level: number;
  success: boolean;
  points?: number;
  onPrimary: () => void;
}

const LEVEL_UP_PULSE_DELAY_MS = 700;
const LEVEL_UP_PULSE_DURATION_MS = 600;
const REWARD_DISPLAYS_HOLD_AFTER_SCATTER_MS = 1_000;
type RewardScatterChannel = "points" | "gems";

export function GameResultScreen({ game, level, success, points = 0, onPrimary }: GameResultScreenProps) {
  const { locale, t } = useLocale();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const router = useRouter();
  const { stats, refreshStats } = useProgressStats();
  const { openLeaderboard } = useLeaderboardOverlay();
  const basePoints = stats.totalPoints - points;
  const gainedPoints = points;
  const scoreRef = useRef<HTMLSpanElement>(null);
  const rewardSourceRef = useRef<HTMLDivElement>(null);
  const [displayPoints, setDisplayPoints] = useState(basePoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [levelUpPulseStarted, setLevelUpPulseStarted] = useState(false);
  const [levelUpPulseActive, setLevelUpPulseActive] = useState(false);
  const [completionParticlesVisible, setCompletionParticlesVisible] = useState(false);
  const [completionParticles] = useState(createCompletionParticles);
  const [rewardDisplaysVisible, setRewardDisplaysVisible] = useState(false);
  const activeRewardScatterChannelsRef = useRef(new Set<RewardScatterChannel>());
  const rewardDisplaysHideTimerRef = useRef<number | null>(null);
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
    if (!success) return;

    const startTimer = window.setTimeout(() => {
      setLevelUpPulseStarted(true);
      setLevelUpPulseActive(true);
      setCompletionParticlesVisible(true);
      playSoundEffect("quiz-completion-progress-pop");
    }, LEVEL_UP_PULSE_DELAY_MS);
    const endTimer = window.setTimeout(() => {
      setLevelUpPulseActive(false);
      setCompletionParticlesVisible(false);
    }, LEVEL_UP_PULSE_DELAY_MS + LEVEL_UP_PULSE_DURATION_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [success]);

  useEffect(() => {
    return () => {
      if (rewardDisplaysHideTimerRef.current !== null) {
        window.clearTimeout(rewardDisplaysHideTimerRef.current);
      }
    };
  }, []);

  function handleExit(complete: () => void) {
    if (isExiting) return;

    setIsExiting(true);
    complete();
  }

  function handleRewardScatterStart(channel: RewardScatterChannel) {
    if (rewardDisplaysHideTimerRef.current !== null) {
      window.clearTimeout(rewardDisplaysHideTimerRef.current);
      rewardDisplaysHideTimerRef.current = null;
    }
    activeRewardScatterChannelsRef.current.add(channel);
    setRewardDisplaysVisible(true);
  }

  function handleRewardScatterComplete(channel: RewardScatterChannel) {
    activeRewardScatterChannelsRef.current.delete(channel);
    if (activeRewardScatterChannelsRef.current.size === 0) {
      rewardDisplaysHideTimerRef.current = window.setTimeout(() => {
        rewardDisplaysHideTimerRef.current = null;
        setRewardDisplaysVisible(false);
      }, REWARD_DISPLAYS_HOLD_AFTER_SCATTER_MS);
    }
  }

  const resultTitle = success
    ? t("games.level", { level: level + (levelUpPulseStarted ? 1 : 0) })
    : t("games.failed", { level });

  return (
    <div
      className="game-result-overlay flex h-full w-full items-center justify-center overflow-hidden p-6 text-center"
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7">
        <div ref={rewardSourceRef} className="flex flex-col items-center gap-3">
          <h1
            className={cn(
              "game-result-title text-6xl font-bold leading-none sm:text-7xl",
              success ? "game-result-title-success game-result-level-up text-white" : "text-white",
              canUseSuperWater(locale) && "font-super-water",
            )}
            style={levelUpPulseActive ? { color: "#fff176" } : undefined}
          >
            {completionParticlesVisible ? (
              <span className="relative inline-flex items-center justify-center">
                {formatSuperWaterText(locale, resultTitle)}
                <span className="pointer-events-none absolute inset-0 z-10 block" aria-hidden="true">
                  {completionParticles.map((particle, index) => (
                    <span
                      key={index}
                      className="quiz-completion-particle absolute left-0 top-0 block rounded-[2px]"
                      style={
                        {
                          left: `${particle.startX}%`,
                          top: `${particle.startY}%`,
                          width: particle.size,
                          height: particle.size,
                          backgroundColor: particle.color,
                          animationDuration: `${particle.duration}ms`,
                          animationDelay: `${particle.delay}ms`,
                          "--completion-particle-x": `${particle.x}px`,
                          "--completion-particle-y": `${particle.y}px`,
                          "--completion-particle-rotation": `${particle.rotation}deg`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              </span>
            ) : (
              formatSuperWaterText(locale, resultTitle)
            )}
          </h1>
        </div>

        <div className="flex items-center justify-center gap-4">
          {success ? (
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.leaderboard}
              imageSizes="64px"
              onClick={() => openLeaderboard()}
              aria-label={t("leaderboard.title")}
              data-game-result-action="leaderboard"
              className="game-result-action-leaderboard size-16"
            />
          ) : null}
          <ImageActionButton
            imageSrc={success ? RESULT_BUTTON_IMAGES.play : RESULT_BUTTON_IMAGES.replay}
            imageSizes="80px"
            onClick={() => handleExit(onPrimary)}
            aria-label={success ? t("games.nextLevel") : t("games.tryAgain")}
            data-game-result-action={success ? "play" : "replay"}
            className="game-result-action-primary size-20"
          />
          <ImageActionButton
            imageSrc={RESULT_BUTTON_IMAGES.menu}
            imageSizes={success ? "64px" : "80px"}
            onClick={() => handleExit(() => router.push("/games"))}
            aria-label={t("games.menu")}
            data-game-result-action="menu"
            className={cn("game-result-action-menu", success ? "size-16" : "size-20")}
          />
        </div>

      </div>
      {success ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-8 z-20 flex items-center justify-center gap-3 transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            rewardDisplaysVisible ? "scale-100 opacity-100" : "scale-[0.72] opacity-0",
          )}
          data-game-result-reward-displays
        >
          <MainPointsDisplay
            targetRef={scoreRef}
            pulse={scorePulse}
            className="game-result-score px-4 py-2"
            valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
            value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
          />
          <RewardGemHud
            balances={gemDisplayBalances}
            pulse={gemPulse}
            animate
            desktopVisible
          />
        </div>
      ) : null}
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
        onPointsStart={() => handleRewardScatterStart("points")}
        onPointsArrive={(awardedTotal, arrivalIndex) => {
          setDisplayPoints(basePoints + awardedTotal);
          setScorePulse(arrivalIndex);
        }}
        onPointsComplete={() => {
          handleRewardScatterComplete("points");
          void refreshStats();
        }}
        onGemsStart={() => handleRewardScatterStart("gems")}
        onGemArrive={handleGemArrive}
        onGemsComplete={() => {
          handleRewardScatterComplete("gems");
          finishGemRewardDisplay(gemFinalBalancesRef.current);
          void refreshProfile();
        }}
      />
    </div>
  );
}
