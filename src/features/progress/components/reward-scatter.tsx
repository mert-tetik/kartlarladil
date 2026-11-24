"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
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
  type RewardScatterMedalsRequest,
} from "@/features/progress/reward-scatter";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import {
  useQuizAnimationFastForward,
} from "@/features/quiz/components/quiz-animation-fast-forward";

const MAX_GEOMETRY_ATTEMPTS = 60;
const FAST_FORWARD_FLIGHT_DURATION_MS = 400;
const MEDAL_IMAGE_SRC = "/quiz/result-cards/star.webp?v=20261003-2";

export interface PointsScatterRequest {
  amount: number;
  source?: RewardScatterAnchor;
  target?: RewardScatterAnchor;
  targetSelector?: string;
  startDelayMs?: number;
  flightStaggerMs?: number;
  placement?: RewardScatterPlacement;
  scatterOffset?: { x: number; y: number };
  iconCount?: number;
  gemIcon?: GemType;
  iconSize?: number;
  zIndex?: number;
  arrivalSoundEffect?: SoundEffectName | false;
  vibrateOnArrival?: boolean;
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
  medals,
  onPointsStart,
  onPointsLaunch,
  onPointsArrive,
  onPointsComplete,
  onGemLaunch,
  onGemArrive,
  onGemsStart,
  onGemsComplete,
  onMedalArrive,
  onMedalsStart,
  onMedalsUnavailable,
  onMedalsComplete,
  flightExit = false,
  fastForwardSignal,
}: {
  points?: PointsScatterRequest | null;
  gems?: GemsScatterRequest | null;
  medals?: RewardScatterMedalsRequest | null;
  onPointsStart?: () => void;
  onPointsLaunch?: () => void;
  onPointsArrive?: (awardedTotal: number, arrivalIndex: number) => void;
  onPointsComplete?: () => void;
  onGemLaunch?: (type: GemType) => void;
  onGemArrive?: (type: GemType, amountAwarded: number) => void;
  onGemsStart?: () => void;
  onGemsComplete?: () => void;
  onMedalArrive?: (amountAwarded: number, arrivalIndex: number) => void;
  onMedalsStart?: () => void;
  onMedalsUnavailable?: () => void;
  onMedalsComplete?: () => void;
  flightExit?: boolean;
  fastForwardSignal?: number;
}) {
  const scatterInstanceId = useId();
  const [flights, setFlights] = useState<RewardScatterFlight[]>([]);
  const flightsRef = useRef(flights);
  flightsRef.current = flights;
  const fastForwardAnimationsRef = useRef(new Map<string, Animation>());
  const fastForwardFallbackTimersRef = useRef(new Map<string, number>());
  const fastForwardActiveFlightsRef = useRef<() => boolean>(() => false);
  const arrivedFlightIdsRef = useRef({ points: new Set<string>(), gems: new Set<string>(), medals: new Set<string>() });
  const groupFlightCountsRef = useRef({ points: 0, gems: 0, medals: 0 });
  const groupArrivalCountsRef = useRef({ points: 0, gems: 0, medals: 0 });
  const completedGroupsRef = useRef({ points: false, gems: false, medals: false });
  const callbacksRef = useRef({
    onPointsStart,
    onPointsLaunch,
    onPointsArrive,
    onPointsComplete,
    onGemLaunch,
    onGemArrive,
    onGemsStart,
    onGemsComplete,
    onMedalArrive,
    onMedalsStart,
    onMedalsUnavailable,
    onMedalsComplete,
  });
  const previousFastForwardSignalRef = useRef(0);
  callbacksRef.current = {
    onPointsStart,
    onPointsLaunch,
    onPointsArrive,
    onPointsComplete,
    onGemLaunch,
    onGemArrive,
    onGemsStart,
    onGemsComplete,
    onMedalArrive,
    onMedalsStart,
    onMedalsUnavailable,
    onMedalsComplete,
  };

  const pointAmount = points?.amount ?? 0;
  const pointSource = points?.source;
  const pointTarget = points?.target;
  const pointTargetSelector = points?.targetSelector;
  const pointDelay = points?.startDelayMs ?? 0;
  const pointFlightStaggerMs = points?.flightStaggerMs;
  const pointPlacementKey = JSON.stringify(points?.placement ?? null);
  const pointScatterX = points?.scatterOffset?.x;
  const pointScatterY = points?.scatterOffset?.y;
  const pointIconCount = points?.iconCount;
  const pointGemIcon = points?.gemIcon;
  const pointIconSize = points?.iconSize ?? 32;
  const pointZIndex = points?.zIndex ?? 50;
  const pointArrivalSoundEffect = points?.arrivalSoundEffect;
  const pointVibrateOnArrival = points?.vibrateOnArrival;

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
  const medalAmount = medals?.amount ?? 0;
  const medalSource = medals?.source;
  const medalSourcesKey = JSON.stringify(medals?.sources ?? null);
  const medalTarget = medals?.target;
  const medalDelay = medals?.startDelayMs ?? 0;
  const medalPlacementKey = JSON.stringify(medals?.placement ?? null);
  const medalScatterX = medals?.scatterOffset?.x;
  const medalScatterY = medals?.scatterOffset?.y;
  const medalIconSize = medals?.iconSize ?? 40;
  const medalZIndex = medals?.zIndex ?? 112;
  const medalArrivalSoundEffect = medals?.arrivalSoundEffect ?? "points";

  useEffect(() => {
    if (pointAmount <= 0 || flightExit) return;

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
          flightStaggerMs: pointFlightStaggerMs,
          placement: parsePlacement(pointPlacementKey),
          scatterOffset: pointScatterX === undefined || pointScatterY === undefined
            ? undefined
            : { x: pointScatterX, y: pointScatterY },
          iconSize: pointIconSize,
          zIndex: pointZIndex,
          arrivalSoundEffect: pointArrivalSoundEffect,
          vibrateOnArrival: pointVibrateOnArrival,
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
  }, [pointAmount, pointSource, pointTarget, pointTargetSelector, pointDelay, pointFlightStaggerMs, pointPlacementKey, pointScatterX, pointScatterY, pointIconCount, pointGemIcon, pointIconSize, pointZIndex, pointArrivalSoundEffect, pointVibrateOnArrival, flightExit]);

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

  useEffect(() => {
    if (medalAmount <= 0) return;

    let cancelled = false;
    let geometryAttempt = 0;
    let frame: number | null = null;
    const timers: number[] = [];
    groupArrivalCountsRef.current.medals = 0;
    groupFlightCountsRef.current.medals = 0;
    completedGroupsRef.current.medals = false;

    const startWhenReady = () => {
      if (cancelled) return;
      const source = resolveRect(medalSource, false);
      const target = resolveRect(medalTarget, false)
        ?? document.querySelector<HTMLElement>("[data-main-medals-target]")?.getBoundingClientRect()
        ?? null;

      if (!source || !target || !hasArea(source) || !hasArea(target)) {
        if (geometryAttempt < MAX_GEOMETRY_ATTEMPTS) {
          geometryAttempt += 1;
          frame = window.requestAnimationFrame(startWhenReady);
          return;
        }
        callbacksRef.current.onMedalsUnavailable?.();
        return;
      }

      const medalFlights = createRewardScatterFlights({
        medals: {
          amount: medalAmount,
          source,
          sources: medals?.sources,
          target,
          startDelayMs: 0,
          placement: parsePlacement(medalPlacementKey),
          scatterOffset: medalScatterX === undefined || medalScatterY === undefined
            ? undefined
            : { x: medalScatterX, y: medalScatterY },
          iconSize: medalIconSize,
          zIndex: medalZIndex,
          arrivalSoundEffect: medalArrivalSoundEffect,
        },
      }).filter((flight) => flight.channel === "medals");

      if (!medalFlights.length) {
        callbacksRef.current.onMedalsUnavailable?.();
        return;
      }

      groupFlightCountsRef.current.medals = medalFlights.length;
      arrivedFlightIdsRef.current.medals.clear();
      callbacksRef.current.onMedalsStart?.();
      setFlights((current) => [...current.filter((flight) => flight.channel !== "medals"), ...medalFlights]);
      scheduleArrivalFallbacks(medalFlights, timers);
    };

    const start = () => {
      startWhenReady();
    };
    const startTimer = medalDelay > 0 ? window.setTimeout(start, medalDelay) : null;
    if (startTimer === null) start();

    return () => {
      cancelled = true;
      if (startTimer !== null) window.clearTimeout(startTimer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  // All request fields are expanded so parent re-renders do not restart a running scatter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medalAmount, medalSource, medalSourcesKey, medalTarget, medalDelay, medalPlacementKey, medalScatterX, medalScatterY, medalIconSize, medalZIndex, medalArrivalSoundEffect]);

  function scheduleArrivalFallbacks(groupFlights: RewardScatterFlight[], timers: number[]) {
    for (const flight of groupFlights) {
      timers.push(window.setTimeout(
        () => handleFlightEnd(flight),
        flight.delay + SCORE_FLIGHT_DURATION_MS + 200,
      ));
    }
  }

  function completeGroup(channel: "points" | "gems" | "medals") {
    if (completedGroupsRef.current[channel]) return;
    completedGroupsRef.current[channel] = true;
    if (channel === "points") callbacksRef.current.onPointsComplete?.();
    else if (channel === "gems") callbacksRef.current.onGemsComplete?.();
    else callbacksRef.current.onMedalsComplete?.();
  }

  function handleFlightEnd(flight: RewardScatterFlight) {
    const arrivedIds = arrivedFlightIdsRef.current[flight.channel];
    if (arrivedIds.has(flight.id)) return;

    const fastForwardAnimation = fastForwardAnimationsRef.current.get(flight.id);
    // Ignore the original CSS animation's end event while its accelerated
    // replacement is still flying to the HUD.
    if (fastForwardAnimation?.playState === "running") return;
    arrivedIds.add(flight.id);

    if (fastForwardAnimation) {
      fastForwardAnimationsRef.current.delete(flight.id);
      fastForwardAnimation.onfinish = null;
      fastForwardAnimation.cancel();
    }
    const fallbackTimer = fastForwardFallbackTimersRef.current.get(flight.id);
    if (fallbackTimer !== undefined) {
      window.clearTimeout(fallbackTimer);
      fastForwardFallbackTimersRef.current.delete(flight.id);
    }

    setFlights((current) => current.filter((item) => item.id !== flight.id));

    if (flight.channel === "points") {
      groupArrivalCountsRef.current.points += 1;
      callbacksRef.current.onPointsArrive?.(flight.pointsAwarded ?? 0, flight.arrivalIndex);
    } else if (flight.gemType) {
      groupArrivalCountsRef.current.gems += 1;
      callbacksRef.current.onGemArrive?.(flight.gemType, flight.gemAmountAwarded ?? 1);
    } else if (flight.channel === "medals") {
      groupArrivalCountsRef.current.medals += 1;
      callbacksRef.current.onMedalArrive?.(flight.pointsAwarded ?? 1, flight.arrivalIndex);
    }

    if (flight.arrivalSoundEffect) playSoundEffect(flight.arrivalSoundEffect);
    if (flight.vibrateOnArrival) {
      vibrate(flight.channel === "medals" ? "reward-arrival" : "tap");
    }

    if (groupArrivalCountsRef.current[flight.channel] >= groupFlightCountsRef.current[flight.channel]) {
      completeGroup(flight.channel);
    }
  }

  function handleFlightExit(flight: RewardScatterFlight) {
    arrivedFlightIdsRef.current[flight.channel].add(flight.id);
    setFlights((current) => current.filter((item) => item.id !== flight.id));
  }

  function fastForwardActiveFlights() {
    if (typeof document === "undefined") return false;

    const elements = new Map(
      Array.from(document.querySelectorAll<HTMLElement>("[data-reward-flight-id]"))
        .filter((element) => element.dataset.rewardScatterInstanceId === scatterInstanceId)
        .map((element) => [element.dataset.rewardFlightId ?? "", element]),
    );
    let handled = false;
    for (const flight of flightsRef.current) {
      const element = elements.get(flight.id);
      if (!element) continue;

      if (flight.channel === "points" || flight.channel === "gems") {
        const inFlightFastForward = fastForwardAnimationsRef.current.get(flight.id);
        if (inFlightFastForward?.playState === "running") {
          try {
            inFlightFastForward.finish();
          } catch {
            // The logical completion below remains authoritative if Web
            // Animations is interrupted or unsupported by the embedded view.
          }
          handleFlightEnd(flight);
          handled = true;
          continue;
        }
        if (fastForwardFallbackTimersRef.current.has(flight.id)) {
          const fallbackTimer = fastForwardFallbackTimersRef.current.get(flight.id);
          if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
          fastForwardFallbackTimersRef.current.delete(flight.id);
          handleFlightEnd(flight);
          handled = true;
          continue;
        }

        const computedStyle = window.getComputedStyle(element);
        const currentRect = element.getBoundingClientRect();
        const layoutWidth = element.offsetWidth || flight.iconSize;
        const layoutHeight = element.offsetHeight || flight.iconSize;
        const hasCurrentRect = currentRect.width > 0 && currentRect.height > 0;
        const currentTransform = hasCurrentRect
          ? `translate3d(${currentRect.left}px, ${currentRect.top}px, 0) scale(${currentRect.width / layoutWidth}, ${currentRect.height / layoutHeight})`
          : computedStyle.transform !== "none" && computedStyle.transform
            ? computedStyle.transform
            : element.style.transform;
        const transformOrigin = hasCurrentRect ? "top left" : element.style.transformOrigin;
        const parsedOpacity = Number.parseFloat(computedStyle.opacity);
        // Delayed flights are hidden by their backwards-fill state; reveal them
        // as they join the same accelerated trip to the HUD.
        const currentOpacity = Number.isFinite(parsedOpacity) && parsedOpacity > 0
          ? parsedOpacity
          : 1;
        const currentTargetRect = flight.channel === "points"
          ? resolveRect(pointTarget, false)
            ?? (pointTargetSelector
              ? document.querySelector<HTMLElement>(pointTargetSelector)?.getBoundingClientRect() ?? null
              : null)
          : flight.gemType
            ? document.querySelector<HTMLElement>(
                appendGemTypeSelector(gemTargetSelector, flight.gemType),
              )?.getBoundingClientRect() ?? null
            : null;
        const targetCenterX = currentTargetRect && hasArea(currentTargetRect)
          ? currentTargetRect.left + currentTargetRect.width / 2
          : flight.targetX;
        const targetCenterY = currentTargetRect && hasArea(currentTargetRect)
          ? currentTargetRect.top + currentTargetRect.height / 2
          : flight.targetY;
        const targetLeft = targetCenterX - layoutWidth * 0.25;
        const targetTop = targetCenterY - layoutHeight * 0.25;
        const targetTransform = hasCurrentRect
          ? `translate3d(${targetLeft}px, ${targetTop}px, 0) scale(0.5)`
          : `translate3d(${flight.targetX}px, ${flight.targetY}px, 0) scale(0.5)`;

        try {
          if (typeof element.getAnimations === "function") {
            for (const animation of element.getAnimations({ subtree: false })) {
              animation.cancel();
            }
          }
        } catch {
          // Continue with the explicit target flight if getAnimations options
          // are unsupported by this embedded browser.
        }

        // Disable the declarative flight animation after sampling its current
        // frame so it cannot restart or emit a stale completion during the
        // accelerated WAAPI flight.
        element.style.animation = "none";
        element.style.transformOrigin = transformOrigin;
        element.style.transform = currentTransform;
        element.style.opacity = String(currentOpacity);
        void element.offsetWidth;

        let acceleratedAnimation: Animation | null = null;
        if (typeof element.animate === "function") {
          try {
            acceleratedAnimation = element.animate(
              [
                { transform: currentTransform, opacity: currentOpacity },
                { transform: targetTransform, opacity: 0 },
              ],
              {
                duration: FAST_FORWARD_FLIGHT_DURATION_MS,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                fill: "forwards",
              },
            );
          } catch {
            acceleratedAnimation = null;
          }
        }

        if (acceleratedAnimation) {
          fastForwardAnimationsRef.current.set(flight.id, acceleratedAnimation);
          acceleratedAnimation.onfinish = () => {
            fastForwardAnimationsRef.current.delete(flight.id);
            handleFlightEnd(flight);
          };
        } else {
          // CSS-transition fallback for embedded browsers without Web Animations API.
          element.style.animation = "none";
          element.style.transition = "none";
          element.style.transformOrigin = transformOrigin;
          element.style.transform = currentTransform;
          element.style.opacity = String(currentOpacity);
          void element.offsetWidth;
          element.style.transition = `transform ${FAST_FORWARD_FLIGHT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FAST_FORWARD_FLIGHT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          element.style.transform = targetTransform;
          element.style.opacity = "0";
          const timer = window.setTimeout(() => {
            fastForwardFallbackTimersRef.current.delete(flight.id);
            handleFlightEnd(flight);
          }, FAST_FORWARD_FLIGHT_DURATION_MS);
          fastForwardFallbackTimersRef.current.set(flight.id, timer);
        }

        handled = true;
        continue;
      }

      // Finish delayed/staggered flights too. They are already part of the
      // active scatter even if their CSS animation has not reached its start
      // offset yet. Medal flights keep their existing instant fast-forward behavior.
      try {
        if (typeof element.getAnimations === "function") {
          for (const animation of element.getAnimations({ subtree: true })) {
            if (animation.playState === "finished" || animation.playState === "idle") continue;
            animation.finish();
          }
        }
      } catch {
        // The flight's logical arrival below still guarantees completion.
      }

      handled = true;
      handleFlightEnd(flight);
    }
    return handled;
  }

  useEffect(() => {
    fastForwardActiveFlightsRef.current = fastForwardActiveFlights;
  }, [fastForwardActiveFlights]);

  const invokeFastForwardActiveFlights = useCallback(
    () => fastForwardActiveFlightsRef.current(),
    [],
  );

  useQuizAnimationFastForward(invokeFastForwardActiveFlights, flights.length > 0, 20);

  useEffect(() => {
    if (fastForwardSignal === undefined || fastForwardSignal === previousFastForwardSignalRef.current) return;
    // Keep an early tap pending until the scatter has actually created its
    // flights; otherwise a very quick second tap could be consumed on mount.
    if (flights.length === 0) return;
    previousFastForwardSignalRef.current = fastForwardSignal;
    fastForwardActiveFlightsRef.current();
  }, [fastForwardSignal, flights.length]);

  useEffect(() => {
    if (!flightExit) return;

    const timeout = window.setTimeout(() => {
      const activeFlights = flightsRef.current;
      for (const flight of activeFlights) {
        arrivedFlightIdsRef.current[flight.channel].add(flight.id);
      }
      setFlights([]);
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [flightExit]);

  useEffect(() => () => {
    for (const animation of fastForwardAnimationsRef.current.values()) {
      animation.onfinish = null;
      animation.cancel();
    }
    fastForwardAnimationsRef.current.clear();
    for (const timer of fastForwardFallbackTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    fastForwardFallbackTimersRef.current.clear();
  }, []);

  if (typeof document === "undefined" || flights.length === 0) return null;

  return createPortal(
    <>
      {flights.map((flight) => (
        <span
          key={flight.id}
          aria-hidden="true"
          data-reward-flight-channel={flight.channel}
          data-reward-flight-id={flight.id}
          data-reward-scatter-instance-id={scatterInstanceId}
          className={`pointer-events-none fixed left-0 top-0 ${flight.animation === "medal" ? "animate-quiz-medal-icon-flight" : "animate-quiz-score-icon-flight"} ${flightExit ? "quiz-performance-flight-exiting" : ""}`}
          onAnimationStart={() => {
            if (flight.channel === "points") callbacksRef.current.onPointsLaunch?.();
            else if (flight.gemType) callbacksRef.current.onGemLaunch?.(flight.gemType);
          }}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget || flightExit) return;
            handleFlightEnd(flight);
          }}
          style={{
            zIndex: flight.zIndex,
            opacity: 1,
            transform: `translate3d(${flight.startX}px, ${flight.startY}px, 0)`,
            "--score-flight-start-x": `${flight.startX}px`,
            "--score-flight-start-y": `${flight.startY}px`,
            "--score-flight-scatter-x": `${flight.startX + flight.scatterX}px`,
            "--score-flight-scatter-y": `${flight.startY + flight.scatterY}px`,
            "--score-flight-target-x": `${flight.targetX}px`,
            "--score-flight-target-y": `${flight.targetY}px`,
            animationDelay: `${flight.delay}ms`,
          } as CSSProperties}
        >
          <span
            className={flightExit ? "quiz-performance-flight-exit-content" : undefined}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && flightExit) handleFlightExit(flight);
            }}
          >
            {flight.visual.kind === "points" ? (
              <ScoreIcon size={flight.iconSize} />
            ) : flight.visual.kind === "medal" ? (
              <span
                className="result-medal-center-wobble block"
                style={{ width: flight.iconSize, height: flight.iconSize }}
              >
                <img
                  src={MEDAL_IMAGE_SRC}
                  alt=""
                  width={flight.iconSize}
                  height={flight.iconSize}
                  draggable={false}
                  className="size-full object-contain"
                />
              </span>
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
