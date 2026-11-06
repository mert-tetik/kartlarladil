"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

const FRAME_COUNT = 50;
const FRAME_FPS = 45;
const FRAME_BASE_PATH: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "/pricing-subscription-menu-frames-v2",
  pro: "/pricing-subscription-menu-pro-frames-v2",
};

export const SUBSCRIPTION_DETAILS_EXIT_DURATION_MS = 300;

export function SubscriptionDetailsFrameAnimation({
  isClosing,
  onComplete,
  plan,
}: {
  isClosing: boolean;
  onComplete: () => void;
  plan: Exclude<SubscriptionPlan, "free">;
}) {
  const [frameIndex, setFrameIndex] = useState(1);
  const frameIndexRef = useRef(1);
  const frameBasePath = FRAME_BASE_PATH[plan];

  useEffect(() => {
    let cancelled = false;
    let animationFrameId: number | null = null;
    const frameDuration = 1000 / FRAME_FPS;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const preloadFrames = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = `${frameBasePath}/${index + 1}.webp`;
      return image;
    });

    if (prefersReducedMotion) {
      animationFrameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        frameIndexRef.current = FRAME_COUNT;
        setFrameIndex(FRAME_COUNT);
        onComplete();
      });
      return () => {
        cancelled = true;
        preloadFrames.forEach((image) => {
          image.onload = null;
          image.onerror = null;
        });
      };
    }

    const startedAt = window.performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const nextFrame = Math.min(FRAME_COUNT, Math.floor((now - startedAt) / frameDuration) + 1);
      if (nextFrame !== frameIndexRef.current) {
        frameIndexRef.current = nextFrame;
        setFrameIndex(nextFrame);
      }
      if (nextFrame === FRAME_COUNT) onComplete();
      if (nextFrame < FRAME_COUNT) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [frameBasePath, onComplete]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "subscription-details-frame-layer",
        plan === "pro" && "subscription-details-frame-layer--pro",
        isClosing && "subscription-details-frame-layer--closing",
      )}
      data-subscription-details-frame-layer
    >
      {/* Keep the frame strip unoptimized so each animation frame is ready without image-loader latency. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${frameBasePath}/${frameIndex}.webp`} alt="" draggable={false} />
    </div>
  );
}
