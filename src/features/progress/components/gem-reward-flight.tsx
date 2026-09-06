"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { GEM_ASSETS, type GemReward, type GemRewards, type GemType } from "@/features/gems/gem-types";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

const LAST_START_MS = 780;
const FLIGHT_DURATION_MS = 700;
const GEM_FLIGHT_ICON_SIZE = 40;

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
  startDelayMs = 0,
  onComplete,
  onGemArrive,
  targetSelector = "[data-reward-gem-target]",
}: {
  /** Kept for single-reward callers while all new callers use rewards. */
  reward?: GemReward | null;
  rewards?: GemRewards | null;
  sourceRef: RefObject<HTMLElement | null>;
  startDelayMs?: number;
  onComplete?: () => void;
  onGemArrive?: (type: GemType) => void;
  targetSelector?: string;
}) {
  const [icons, setIcons] = useState<GemFlightIcon[]>([]);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const arrivedRef = useRef(new Set<number>());
  const onCompleteRef = useRef(onComplete);
  const onGemArriveRef = useRef(onGemArrive);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onGemArriveRef.current = onGemArrive;
  }, [onComplete, onGemArrive]);

  useEffect(() => {
    const rewardList = rewards?.length ? rewards : reward ? [reward] : [];
    if (rewardList.length === 0 || startedRef.current) return;
    startedRef.current = true;
    const timers: number[] = [];
    let frame: number | null = null;
    const startTimer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        const source = sourceRef.current?.getBoundingClientRect();
        if (!source || source.width === 0 || source.height === 0) {
          completedRef.current = true;
          onCompleteRef.current?.();
          return;
        }

        const nextIcons: GemFlightIcon[] = [];
        let nextId = 0;
        for (const item of rewardList) {
          if (item.amount <= 0) continue;
          const target = document
            .querySelector<HTMLElement>(`${targetSelector}[data-reward-gem-target="${item.type}"]`)
            ?.getBoundingClientRect();
          if (!target || target.width === 0 || target.height === 0) continue;

          const iconCount = Math.min(Math.max(1, item.amount), 25);
          const targetX = target.left + target.width / 2;
          const targetY = target.top + target.height / 2;
          for (let index = 0; index < iconCount; index += 1) {
            nextIcons.push({
              id: nextId++,
              type: item.type,
              startX: source.left + source.width * (0.2 + Math.random() * 0.6),
              startY: source.top + source.height * (0.2 + Math.random() * 0.6),
              scatterX: (Math.random() - 0.5) * 140,
              scatterY: -30 - Math.random() * 90,
              targetX,
              targetY,
              delay: Math.round((iconCount === 1 ? 0 : index / (iconCount - 1)) * LAST_START_MS),
            });
          }
        }
        if (nextIcons.length === 0) {
          completedRef.current = true;
          onCompleteRef.current?.();
          return;
        }
        setIcons(nextIcons);
        timers.push(window.setTimeout(() => finishFlight(), LAST_START_MS + FLIGHT_DURATION_MS + 500));
      });
    }, startDelayMs);
    timers.push(startTimer);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [reward, rewards, sourceRef, startDelayMs, targetSelector]);

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
    playSoundEffect("gem-loot");
    vibrate("tap");
    if (arrivedRef.current.size === icons.length) finishFlight();
  }

  if (icons.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <>
      {icons.map((icon) => (
        <span
          key={icon.id}
          className="pointer-events-none fixed left-0 top-0 z-[82] animate-quiz-score-icon-flight"
          aria-hidden="true"
          onAnimationEnd={() => handleIconEnd(icon.id)}
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
