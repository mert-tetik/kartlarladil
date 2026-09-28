"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { useProgressStats } from "@/features/progress/progress-client";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { useLocale } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { RewardGemHud, type GemHudPulse } from "@/features/progress/components/reward-gem-hud";
import type { GemBalances, GemType } from "@/features/gems/gem-types";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { MissionRewardAnimationMode } from "../mission-reward-queue";

type MissionPointsAnimationMode = Extract<MissionRewardAnimationMode, { kind: "points" }>;
type MissionGemsAnimationMode = Extract<MissionRewardAnimationMode, { kind: "gems" }>;
type MissionChestAnimationMode = Extract<MissionRewardAnimationMode, { kind: "chest" }>;

interface MissionRewardOverlayProps {
  modes: MissionRewardAnimationMode[];
  onComplete: (missionId: string) => void;
}

const EXIT_DURATION_MS = 500;
const POINT_DROP_DELAY_MS = 220;
const POINT_CLOSE_DELAY_MS = 500;

function removeMissionAmount(current: Record<string, number>, missionId: string) {
  if (!(missionId in current)) return current;
  const next = { ...current };
  delete next[missionId];
  return next;
}

export function MissionRewardOverlay({ modes, onComplete }: MissionRewardOverlayProps) {
  const { stats } = useProgressStats();
  const pointModes = modes.filter((mode): mode is MissionPointsAnimationMode => mode.kind === "points");
  const gemModes = modes.filter((mode): mode is MissionGemsAnimationMode => mode.kind === "gems");
  const chestMode = modes.find((mode): mode is MissionChestAnimationMode => mode.kind === "chest") ?? null;
  const [exitingChestMissionId, setExitingChestMissionId] = useState<string | null>(null);
  const exiting = chestMode?.missionId === exitingChestMissionId;
  const exitTimerRef = useRef<number | null>(null);
  const lastChestIdRef = useRef(chestMode?.missionId ?? null);

  useEffect(() => {
    const currentChestId = chestMode?.missionId ?? null;
    if (currentChestId !== lastChestIdRef.current && exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    lastChestIdRef.current = currentChestId;
  }, [chestMode?.missionId]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleChildComplete = useCallback((missionId: string) => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }

    setExitingChestMissionId(missionId);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setExitingChestMissionId((current) => current === missionId ? null : current);
      onComplete(missionId);
    }, EXIT_DURATION_MS);
  }, [onComplete]);

  const chestOverlay = chestMode ? (
    <div
      data-mission-reward-overlay
      data-state={exiting ? "closing" : "open"}
      className={cn(
        "animate-screen-pop fixed inset-0 z-50 overflow-hidden bg-background transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        exiting ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          exiting ? "scale-[0.985] opacity-0" : "scale-100 opacity-100",
        )}
      >
        <ChestOpeningView key={chestMode.missionId} tier={chestMode.tier} totalPoints={stats.totalPoints} reward={chestMode.gemReward} onComplete={() => handleChildComplete(chestMode.missionId)} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <MissionScatterFlightStack
        pointModes={pointModes}
        gemModes={gemModes}
        totalPoints={stats.totalPoints}
        onComplete={onComplete}
      />
      {chestOverlay && typeof document !== "undefined" ? createPortal(chestOverlay, document.body) : null}
    </>
  );
}

function MissionScatterFlightStack({
  pointModes,
  gemModes,
  totalPoints,
  onComplete,
}: {
  pointModes: MissionPointsAnimationMode[];
  gemModes: MissionGemsAnimationMode[];
  totalPoints: number;
  onComplete: (missionId: string) => void;
}) {
  const { locale } = useLocale();
  const authSession = useOptionalAuthSession();
  const scoreRef = useRef<HTMLSpanElement>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [arrivedPointsByMission, setArrivedPointsByMission] = useState<Record<string, number>>({});
  const [arrivedGemsByMission, setArrivedGemsByMission] = useState<Record<string, number>>({});
  const [pulse, setPulse] = useState(0);
  const [gemPulse, setGemPulse] = useState<GemHudPulse | null>(null);
  const gemPulseKeyRef = useRef(0);
  const hasActiveModes = pointModes.length > 0 || gemModes.length > 0;
  const pointsStillInFlight = pointModes.reduce((sum, mode) => {
    if (!mode.claimSettled) return sum;
    const arrived = Math.min(mode.amount, arrivedPointsByMission[mode.missionId] ?? 0);
    return sum + Math.max(0, mode.amount - arrived);
  }, 0);
  const displayPoints = Math.max(0, totalPoints - pointsStillInFlight);
  const profileGemBalances: GemBalances = {
    blue: authSession?.user?.profile.blueGems ?? 0,
    green: authSession?.user?.profile.greenGems ?? 0,
    purple: authSession?.user?.profile.purpleGems ?? 0,
  };
  const pendingGemAmounts: GemBalances = { blue: 0, green: 0, purple: 0 };
  for (const mode of gemModes) {
    if (!mode.balances) continue;
    pendingGemAmounts[mode.gemType] += Math.max(0, mode.amount - (arrivedGemsByMission[mode.missionId] ?? 0));
  }
  const displayGemBalances: GemBalances = {
    blue: Math.max(0, profileGemBalances.blue - pendingGemAmounts.blue),
    green: Math.max(0, profileGemBalances.green - pendingGemAmounts.green),
    purple: Math.max(0, profileGemBalances.purple - pendingGemAmounts.purple),
  };

  useEffect(() => {
    if (visibilityTimerRef.current !== null) {
      window.clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = null;
    }

    if (hasActiveModes && !visible) {
      visibilityTimerRef.current = window.setTimeout(() => setVisible(true), 100);
    } else if (!hasActiveModes && visible) {
      visibilityTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 420);
    }

    return () => {
      if (visibilityTimerRef.current !== null) {
        window.clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
    };
  }, [hasActiveModes, visible]);

  useEffect(() => () => {
    if (visibilityTimerRef.current !== null) window.clearTimeout(visibilityTimerRef.current);
  }, []);

  if (typeof document === "undefined" || (!hasActiveModes && !visible)) return null;

  return createPortal(<>
    <div
      data-mission-points-flight-stack
      data-active-point-reward-count={pointModes.length}
      data-active-gem-reward-count={gemModes.length}
      className={cn("pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2 transition-all duration-300", visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0")}
    >
      <MainPointsDisplay
        targetRef={scoreRef}
        pulse={pulse}
        valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
        value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
      />
      <div data-mission-scatter-gem-hud>
        <RewardGemHud className="mt-2" animate pulse={gemPulse} balances={displayGemBalances} />
      </div>
    </div>
    {pointModes.map((mode) => (
      <RewardScatter
        key={mode.missionId}
        points={{
          amount: mode.amount,
          source: mode.source ?? null,
          target: scoreRef,
          startDelayMs: 100,
          placement: { origin: "random", spreadX: 80, spreadY: 50, spreadUnit: "pixels" },
          zIndex: 71,
        }}
        onPointsStart={() => setArrivedPointsByMission((current) => ({ ...current, [mode.missionId]: 0 }))}
        onPointsArrive={(awardedTotal) => {
          setArrivedPointsByMission((current) => ({
            ...current,
            [mode.missionId]: Math.max(current[mode.missionId] ?? 0, awardedTotal),
          }));
          setPulse((current) => current + 1);
        }}
        onPointsComplete={() => {
          setArrivedPointsByMission((current) => removeMissionAmount(current, mode.missionId));
          onComplete(mode.missionId);
        }}
      />
    ))}
    {gemModes.map((mode) => (
      <RewardScatter
        key={mode.missionId}
        gems={{
          rewards: [{ type: mode.gemType, amount: mode.amount }],
          source: mode.source ?? null,
          targetSelector: '[data-mission-scatter-gem-hud] [data-reward-gem-target]',
          startDelayMs: 100,
          placement: { origin: "random", spreadX: 80, spreadY: 50, spreadUnit: "pixels" },
          zIndex: 72,
        }}
        onGemsStart={() => setArrivedGemsByMission((current) => ({ ...current, [mode.missionId]: 0 }))}
        onGemArrive={(type: GemType, amountAwarded) => {
          setArrivedGemsByMission((current) => ({
            ...current,
            [mode.missionId]: (current[mode.missionId] ?? 0) + amountAwarded,
          }));
          gemPulseKeyRef.current += 1;
          setGemPulse({ type, key: gemPulseKeyRef.current });
        }}
        onGemsComplete={() => {
          setArrivedGemsByMission((current) => removeMissionAmount(current, mode.missionId));
          onComplete(mode.missionId);
        }}
      />
    ))}
  </>, document.body);
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
  const { locale } = useLocale();
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("idle");
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const dropTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const bonusCompletedRef = useRef(false);

  useEffect(() => {
    playSoundEffect("mission-claim");
    vibrate("confetti");

    dropTimerRef.current = window.setTimeout(() => {
      setBonusPhase("dropping");
    }, POINT_DROP_DELAY_MS);

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
    }, POINT_CLOSE_DELAY_MS);
  }

  return (
    <div
      data-mission-points-celebration
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-85" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_30%)]" />
      </div>

      <div className="relative flex items-center justify-center">
        <MainPointsDisplay
          data-mission-total-points-shell
          className="min-w-[min(76vw,17rem)] gap-2.5 px-6 py-4 sm:min-w-[19rem] sm:px-8 sm:py-5"
          groupClassName="gap-2.5"
          pulse={bonusPhase === "bobble"}
          icon={<Star className="size-6 fill-current sm:size-7" aria-hidden="true" />}
          valueDataAttributes={{ "data-mission-total-points": "" }}
          valueClassName={cn("text-3xl font-bold tracking-tight sm:text-4xl", canUseSuperWater(locale) && "font-super-water")}
          value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
        >
          {bonusPhase === "dropping" ? (
            <span
              className="animate-mission-points-fall-far pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-4xl font-bold text-amber-100 drop-shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:text-5xl"
              onAnimationEnd={handleAnimationEnd}
            >
              <span>{amount}</span>
              <ScoreIcon size={32} className="size-8 sm:size-10" />
            </span>
          ) : null}
        </MainPointsDisplay>
      </div>
    </div>
  );
}
