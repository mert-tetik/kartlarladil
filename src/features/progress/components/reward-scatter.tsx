"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ScoreIcon } from "@/components/score-icon";
import { GEM_ASSETS, type GemRewards, type GemType } from "@/features/gems/gem-types";
import type { SoundEffectName } from "@/lib/sound-effects";
import {
  createRewardScatterFlights,
  SCORE_FLIGHT_DURATION_MS,
  type RewardScatterAnchor,
  type RewardScatterFlight,
  type RewardScatterGemRequest,
  type RewardScatterPlacement,
  type RewardScatterRect,
} from "@/features/progress/reward-scatter";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

const MAX_GEOMETRY_ATTEMPTS = 60;

export interface PointsScatterRequest {
  amount: number;
  source?: RewardScatterAnchor;
  target?: RewardScatterAnchor;
  targetSelector?: string;
  startDelayMs?: number;
  placement?: RewardScatterPlacement;
  scatterOffset?: { x: number; y: number };
  iconCount?: number;
  gemIcon?: GemType;
  iconSize?: number;
  zIndex?: number;
}

export interface GemsScatterRequest {
  rewards: GemRewards;
  source?: RewardScatterAnchor;
  sources?: Partial<Record<GemType, RewardScatterAnchor>>;
  targetSelector?: string;
  startDelayMs?: number;
  placement?: RewardScatterPlacement;
  iconSize?: number;
  zIndex?: number;
  arrivalSoundEffect?: SoundEffectName;
}

export function RewardScatter({
  points,
  gems,
  onPointsStart,
  onPointsLaunch,
  onPointsArrive,
  onPointsComplete,
  onGemLaunch,
  onGemArrive,
  onGemsStart,
  onGemsComplete,
}: {
  points?: PointsScatterRequest | null;
  gems?: GemsScatterRequest | null;
  onPointsStart?: () => void;
  onPointsLaunch?: () => void;
  onPointsArrive?: (awardedTotal: number, arrivalIndex: number) => void;
  onPointsComplete?: () => void;
  onGemLaunch?: (type: GemType) => void;
  onGemArrive?: (type: GemType, amountAwarded: number) => void;
  onGemsStart?: () => void;
  onGemsComplete?: () => void;
}) {
  const [flights, setFlights] = useState<RewardScatterFlight[]>([]);
  const arrivedFlightIdsRef = useRef({ points: new Set<string>(), gems: new Set<string>() });
  const groupFlightCountsRef = useRef({ points: 0, gems: 0 });
  const groupArrivalCountsRef = useRef({ points: 0, gems: 0 });
  const completedGroupsRef = useRef({ points: false, gems: false });
  const callbacksRef = useRef({
    onPointsStart,
    onPointsLaunch,
    onPointsArrive,
    onPointsComplete,
    onGemLaunch,
    onGemArrive,
    onGemsStart,
    onGemsComplete,
  });
  callbacksRef.current = {
    onPointsStart,
    onPointsLaunch,
    onPointsArrive,
    onPointsComplete,
    onGemLaunch,
    onGemArrive,
    onGemsStart,
    onGemsComplete,
  };

  const pointAmount = points?.amount ?? 0;
  const pointSource = points?.source;
  const pointTarget = points?.target;
  const pointTargetSelector = points?.targetSelector;
  const pointDelay = points?.startDelayMs ?? 0;
  const pointPlacementKey = JSON.stringify(points?.placement ?? null);
  const pointScatterX = points?.scatterOffset?.x;
  const pointScatterY = points?.scatterOffset?.y;
  const pointIconCount = points?.iconCount;
  const pointGemIcon = points?.gemIcon;
  const pointIconSize = points?.iconSize ?? 32;
  const pointZIndex = points?.zIndex ?? 50;

  const gemRewards = gems?.rewards ?? [];
  const gemRewardsKey = gemRewards.map((item) => `${item.type}:${item.amount}`).join("|");
  const gemSource = gems?.source;
  const gemSources = gems?.sources;
  const gemTargetSelector = gems?.targetSelector ?? '[data-reward-gem-hud-role="main"] [data-reward-gem-target]';
  const gemDelay = gems?.startDelayMs ?? 0;
  const gemPlacementKey = JSON.stringify(gems?.placement ?? null);
  const gemIconSize = gems?.iconSize ?? 40;
  const gemZIndex = gems?.zIndex ?? 112;
  const gemArrivalSoundEffect = gems?.arrivalSoundEffect ?? "gem-loot";
  const gemSourceBlue = gemSources?.blue;
  const gemSourceGreen = gemSources?.green;
  const gemSourcePurple = gemSources?.purple;

  useEffect(() => {
    if (pointAmount <= 0) return;

    let cancelled = false;
    let geometryAttempt = 0;
    let frame: number | null = null;
    const timers: number[] = [];
    groupArrivalCountsRef.current.points = 0;
    groupFlightCountsRef.current.points = 0;
    completedGroupsRef.current.points = false;

    const finishWithoutFlights = () => completeGroup("points");
    const startWhenReady = () => {
      if (cancelled) return;
      const source = resolveRect(pointSource, true);
      const target = resolveRect(pointTarget, false)
        ?? (pointTargetSelector ? document.querySelector<HTMLElement>(pointTargetSelector)?.getBoundingClientRect() ?? null : null);

      if (!source || !target || !hasArea(target) || (pointSource && !hasArea(source))) {
        if (geometryAttempt < MAX_GEOMETRY_ATTEMPTS) {
          geometryAttempt += 1;
          frame = window.requestAnimationFrame(startWhenReady);
          return;
        }
        finishWithoutFlights();
        return;
      }

      const generated = createRewardScatterFlights({
        points: {
          amount: pointAmount,
          source,
          target,
          iconCount: pointIconCount,
          gemIcon: pointGemIcon,
          startDelayMs: 0,
          placement: parsePlacement(pointPlacementKey),
          scatterOffset: pointScatterX === undefined || pointScatterY === undefined
            ? undefined
            : { x: pointScatterX, y: pointScatterY },
          iconSize: pointIconSize,
          zIndex: pointZIndex,
          arrivalSoundEffect: "points",
        },
      });
      const pointFlights = generated.filter((flight) => flight.channel === "points");
      if (pointFlights.length === 0) {
        finishWithoutFlights();
        return;
      }
      groupFlightCountsRef.current.points = pointFlights.length;
      arrivedFlightIdsRef.current.points.clear();
      setFlights((current) => [...current.filter((flight) => flight.channel !== "points"), ...pointFlights]);
      scheduleArrivalFallbacks(pointFlights, timers);
    };

    const start = () => {
      callbacksRef.current.onPointsStart?.();
      startWhenReady();
    };
    let startTimer: number | null = null;
    if (pointDelay > 0) startTimer = window.setTimeout(start, pointDelay);
    else start();
    return () => {
      cancelled = true;
      if (startTimer !== null) window.clearTimeout(startTimer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  // All request fields are expanded so parent re-renders do not restart a running scatter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointAmount, pointSource, pointTarget, pointTargetSelector, pointDelay, pointPlacementKey, pointScatterX, pointScatterY, pointIconCount, pointGemIcon, pointIconSize, pointZIndex]);

  useEffect(() => {
    if (!gemRewards.length) return;

    let cancelled = false;
    let geometryAttempt = 0;
    let frame: number | null = null;
    const timers: number[] = [];
    groupArrivalCountsRef.current.gems = 0;
    groupFlightCountsRef.current.gems = 0;
    completedGroupsRef.current.gems = false;

    const startWhenReady = () => {
      if (cancelled) return;
      const fallbackSource = [gemSource, gemSourceBlue, gemSourceGreen, gemSourcePurple]
        .map((anchor) => resolveRect(anchor, false))
        .find((rect): rect is RewardScatterRect => Boolean(rect && hasArea(rect))) ?? null;
      const resolvedGems: RewardScatterGemRequest[] = [];

      for (const reward of gemRewards) {
        const sourceAnchor = reward.type === "blue"
          ? gemSourceBlue
          : reward.type === "green"
            ? gemSourceGreen
            : gemSourcePurple;
        const requestedSource = resolveRect(sourceAnchor, false);
        const source = requestedSource && hasArea(requestedSource) ? requestedSource : fallbackSource;
        const targetSelector = appendGemTypeSelector(gemTargetSelector, reward.type);
        const target = document.querySelector<HTMLElement>(targetSelector)?.getBoundingClientRect();
        if (source && target && hasArea(target)) {
          resolvedGems.push({
            type: reward.type,
            amount: reward.amount,
            source,
            target,
            startDelayMs: 0,
            placement: parsePlacement(gemPlacementKey),
            iconSize: gemIconSize,
            zIndex: gemZIndex,
            arrivalSoundEffect: gemArrivalSoundEffect,
          });
        }
      }

      if (resolvedGems.length === 0) {
        if (geometryAttempt < MAX_GEOMETRY_ATTEMPTS) {
          geometryAttempt += 1;
          frame = window.requestAnimationFrame(startWhenReady);
          return;
        }
        completeGroup("gems");
        return;
      }

      const gemFlights = createRewardScatterFlights({ gems: resolvedGems }).filter((flight) => flight.channel === "gems");
      if (!gemFlights.length) {
        completeGroup("gems");
        return;
      }
      groupFlightCountsRef.current.gems = gemFlights.length;
      arrivedFlightIdsRef.current.gems.clear();
      setFlights((current) => [...current.filter((flight) => flight.channel !== "gems"), ...gemFlights]);
      scheduleArrivalFallbacks(gemFlights, timers);
    };

    const start = () => {
      callbacksRef.current.onGemsStart?.();
      startWhenReady();
    };
    let startTimer: number | null = null;
    if (gemDelay > 0) startTimer = window.setTimeout(start, gemDelay);
    else start();
    return () => {
      cancelled = true;
      if (startTimer !== null) window.clearTimeout(startTimer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  // All request fields are expanded so parent re-renders do not restart a running scatter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemRewardsKey, gemSource, gemSourceBlue, gemSourceGreen, gemSourcePurple, gemTargetSelector, gemDelay, gemPlacementKey, gemIconSize, gemZIndex, gemArrivalSoundEffect]);

  function scheduleArrivalFallbacks(groupFlights: RewardScatterFlight[], timers: number[]) {
    for (const flight of groupFlights) {
      timers.push(window.setTimeout(
        () => handleFlightEnd(flight),
        flight.delay + SCORE_FLIGHT_DURATION_MS + 200,
      ));
    }
  }

  function completeGroup(channel: "points" | "gems") {
    if (completedGroupsRef.current[channel]) return;
    completedGroupsRef.current[channel] = true;
    if (channel === "points") callbacksRef.current.onPointsComplete?.();
    else callbacksRef.current.onGemsComplete?.();
  }

  function handleFlightEnd(flight: RewardScatterFlight) {
    const arrivedIds = arrivedFlightIdsRef.current[flight.channel];
    if (arrivedIds.has(flight.id)) return;
    arrivedIds.add(flight.id);
    setFlights((current) => current.filter((item) => item.id !== flight.id));

    if (flight.channel === "points") {
      groupArrivalCountsRef.current.points += 1;
      callbacksRef.current.onPointsArrive?.(flight.pointsAwarded ?? 0, flight.arrivalIndex);
    } else if (flight.gemType) {
      groupArrivalCountsRef.current.gems += 1;
      callbacksRef.current.onGemArrive?.(flight.gemType, flight.gemAmountAwarded ?? 1);
    }

    playSoundEffect(flight.arrivalSoundEffect);
    vibrate("tap");

    if (groupArrivalCountsRef.current[flight.channel] >= groupFlightCountsRef.current[flight.channel]) {
      completeGroup(flight.channel);
    }
  }

  if (typeof document === "undefined" || flights.length === 0) return null;

  return createPortal(
    <>
      {flights.map((flight) => (
        <span
          key={flight.id}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 animate-quiz-score-icon-flight"
          onAnimationStart={() => {
            if (flight.channel === "points") callbacksRef.current.onPointsLaunch?.();
            else if (flight.gemType) callbacksRef.current.onGemLaunch?.(flight.gemType);
          }}
          onAnimationEnd={() => handleFlightEnd(flight)}
          style={{
            zIndex: flight.zIndex,
            "--score-flight-start-x": `${flight.startX}px`,
            "--score-flight-start-y": `${flight.startY}px`,
            "--score-flight-scatter-x": `${flight.startX + flight.scatterX}px`,
            "--score-flight-scatter-y": `${flight.startY + flight.scatterY}px`,
            "--score-flight-target-x": `${flight.targetX}px`,
            "--score-flight-target-y": `${flight.targetY}px`,
            animationDelay: `${flight.delay}ms`,
          } as CSSProperties}
        >
          {flight.visual.kind === "points" ? (
            <ScoreIcon size={flight.iconSize} />
          ) : (
            <Image
              src={GEM_ASSETS[flight.visual.type]}
              alt=""
              width={flight.iconSize}
              height={flight.iconSize}
              className="object-contain"
              style={{ width: flight.iconSize, height: flight.iconSize }}
            />
          )}
        </span>
      ))}
    </>,
    document.body,
  );
}

function resolveRect(anchor: RewardScatterAnchor | undefined, centerWhenMissing: boolean): RewardScatterRect | null {
  if (!anchor) {
    return centerWhenMissing ? viewportCenterRect() : null;
  }

  if (isRefObject(anchor)) {
    return anchor.current?.getBoundingClientRect() ?? null;
  }

  if (isElement(anchor)) return anchor.getBoundingClientRect();
  return anchor;
}

function isRefObject(anchor: Exclude<RewardScatterAnchor, null>): anchor is RefObject<HTMLElement | null> {
  return "current" in anchor;
}

function isElement(anchor: Exclude<RewardScatterAnchor, null>): anchor is HTMLElement {
  return "getBoundingClientRect" in anchor;
}

function viewportCenterRect(): RewardScatterRect {
  return { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
}

function hasArea(rect: RewardScatterRect) {
  return rect.width > 0 && rect.height > 0;
}

function parsePlacement(serialized: string): RewardScatterPlacement | undefined {
  return serialized === "null" ? undefined : JSON.parse(serialized) as RewardScatterPlacement;
}

function appendGemTypeSelector(selector: string, type: GemType) {
  return `${selector}[data-reward-gem-target="${type}"]`;
}
