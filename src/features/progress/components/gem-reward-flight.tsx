"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { GEM_ASSETS, type GemReward, type GemRewards, type GemType } from "@/features/gems/gem-types";
import {
  getChestRewardFlightMotion,
  SCORE_FLIGHT_DURATION_MS,
  SCORE_FLIGHT_LAST_START_MS,
} from "@/features/progress/score-flight";
import { playSoundEffect, type SoundEffectName } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

const GEM_FLIGHT_ICON_SIZE = 40;
const MAX_GEOMETRY_ATTEMPTS = 60;

type GemFlightIcon = {
  id: number;
  type: GemType;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

export function GemRewardFlight({
  reward,
  rewards,
  sourceRef,
  sourceRefs,
  startDelayMs = 0,
  onComplete,
  onGemArrive,
  onGemLaunch,
  targetSelector = "[data-reward-gem-target]",
  arrivalSoundEffect = "gem-loot",
  sourceOrigin = "random",
}: {
  /** Kept for single-reward callers while all new callers use rewards. */
  reward?: GemReward | null;
  rewards?: GemRewards | null;
  sourceRef: RefObject<HTMLElement | null>;
  startDelayMs?: number;
  onComplete?: () => void;
  onGemArrive?: (type: GemType) => void;
  onGemLaunch?: (type: GemType) => void;
  sourceRefs?: Partial<Record<GemType, RefObject<HTMLElement | null>>>;
  targetSelector?: string;
  arrivalSoundEffect?: SoundEffectName;
  sourceOrigin?: "random" | "center";
}) {
  const [icons, setIcons] = useState<GemFlightIcon[]>([]);
  const completedRef = useRef(false);
  const arrivedRef = useRef(new Set<number>());
  const onCompleteRef = useRef(onComplete);
  const onGemArriveRef = useRef(onGemArrive);
  const onGemLaunchRef = useRef(onGemLaunch);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onGemArriveRef.current = onGemArrive;
    onGemLaunchRef.current = onGemLaunch;
  }, [onComplete, onGemArrive, onGemLaunch]);

  useEffect(() => {
    const rewardList = rewards?.length ? rewards : reward ? [reward] : [];
    if (rewardList.length === 0) return;
    completedRef.current = false;
    arrivedRef.current.clear();
    const timers: number[] = [];
    let frame: number | null = null;
    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      let geometryAttempt = 0;

      const startFlightWhenReady = () => {
        if (cancelled) return;

        const fallbackElement = sourceRef.current ?? Object.values(sourceRefs ?? {})
          .map((ref) => ref?.current)
          .find((element): element is HTMLElement => Boolean(element));
        const fallbackSource = fallbackElement?.getBoundingClientRect();
        if (!fallbackSource || fallbackSource.width === 0 || fallbackSource.height === 0) {
          if (geometryAttempt < MAX_GEOMETRY_ATTEMPTS) {
            geometryAttempt += 1;
            frame = window.requestAnimationFrame(startFlightWhenReady);
            return;
          }
          finishFlight();
          return;
        }

        const nextIcons: GemFlightIcon[] = [];
        let nextId = 0;
        for (const item of rewardList) {
          if (item.amount <= 0) continue;
          const source = sourceRefs?.[item.type]?.current?.getBoundingClientRect() ?? fallbackSource;
          if (!source || source.width === 0 || source.height === 0) continue;
          const scopedRect = document
            .querySelector<HTMLElement>(`${targetSelector}[data-reward-gem-target="${item.type}"]`)
            ?.getBoundingClientRect();
          const target = scopedRect && scopedRect.width > 0 && scopedRect.height > 0
            ? scopedRect
            : document
              .querySelector<HTMLElement>(`[data-reward-gem-target="${item.type}"]`)
              ?.getBoundingClientRect();
          if (!target || target.width === 0 || target.height === 0) continue;

          const iconCount = Math.min(Math.max(1, item.amount), 25);
          const targetX = target.left + target.width / 2;
          const targetY = target.top + target.height / 2;
          for (let index = 0; index < iconCount; index += 1) {
            const motion = getChestRewardFlightMotion(source, index, iconCount);
            nextIcons.push({
              id: nextId++,
              type: item.type,
              ...motion,
              ...(sourceOrigin === "center" && {
                startX: source.left + source.width / 2,
                startY: source.top + source.height / 2,
              }),
              targetX,
              targetY,
            });
          }
        }
        if (nextIcons.length === 0) {
          if (geometryAttempt < MAX_GEOMETRY_ATTEMPTS) {
            geometryAttempt += 1;
            frame = window.requestAnimationFrame(startFlightWhenReady);
            return;
          }
          finishFlight();
          return;
        }
        setIcons(nextIcons);
        timers.push(window.setTimeout(
          () => finishFlight(),
          SCORE_FLIGHT_LAST_START_MS + SCORE_FLIGHT_DURATION_MS + 500,
        ));
      };

      frame = window.requestAnimationFrame(startFlightWhenReady);
    }, startDelayMs);
    timers.push(startTimer);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [
    reward,
    rewards?.map((item) => `${item.type}:${item.amount}`).join("|") ?? "",
    sourceRef,
    sourceRefs,
    startDelayMs,
    targetSelector,
    sourceOrigin,
  ]);

  function finishFlight() {
    if (completedRef.current) return;
    completedRef.current = true;
    setIcons([]);
    onCompleteRef.current?.();
  }

  function handleIconEnd(iconId: number) {
    if (arrivedRef.current.has(iconId)) return;
    const icon = icons.find((candidate) => candidate.id === iconId);
    if (!icon) return;
    arrivedRef.current.add(iconId);
    onGemArriveRef.current?.(icon.type);
    playSoundEffect(arrivalSoundEffect);
    vibrate("tap");
    if (arrivedRef.current.size === icons.length) finishFlight();
  }

  if (icons.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <>
      {icons.map((icon) => (
        <span
          key={icon.id}
          className="pointer-events-none fixed left-0 top-0 z-[112] animate-quiz-score-icon-flight"
          aria-hidden="true"
          onAnimationEnd={() => handleIconEnd(icon.id)}
          onAnimationStart={() => onGemLaunchRef.current?.(icon.type)}
          style={{
            "--score-flight-start-x": `${icon.startX}px`,
            "--score-flight-start-y": `${icon.startY}px`,
            "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`,
            "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
            "--score-flight-target-x": `${icon.targetX}px`,
            "--score-flight-target-y": `${icon.targetY}px`,
            animationDelay: `${icon.delay}ms`,
          } as CSSProperties}
        >
          <Image
            src={GEM_ASSETS[icon.type]}
            alt=""
            width={GEM_FLIGHT_ICON_SIZE}
            height={GEM_FLIGHT_ICON_SIZE}
            className="size-10 object-contain"
          />
        </span>
      ))}
    </>,
    document.body,
  );
}
