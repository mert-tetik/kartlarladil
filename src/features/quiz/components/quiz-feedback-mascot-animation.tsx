"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import {
  VideoFrameAtlasPlayer,
  preloadVideoFrameAtlas,
} from "@/components/video-frame-atlas-player";
import type { VideoFrameAtlasAssetId } from "@/lib/video-frame-atlas-assets";

export type QuizFeedbackMascotAnimation = {
  id: "animation-1" | "animation-2" | "animation-3" | "animation-4" | "animation-5" | "Bonus-Celebration";
  frameAtlasId: VideoFrameAtlasAssetId;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
};

export const NORMAL_QUIZ_FEEDBACK_MASCOTS: readonly QuizFeedbackMascotAnimation[] = [
  { id: "animation-1", frameAtlasId: "quiz-feedback-animation-1", frameCount: 104, fps: 24, width: 480, height: 480 },
  { id: "animation-2", frameAtlasId: "quiz-feedback-animation-2", frameCount: 97, fps: 24, width: 752, height: 560 },
  { id: "animation-3", frameAtlasId: "quiz-feedback-animation-3", frameCount: 122, fps: 30, width: 640, height: 480 },
  { id: "animation-4", frameAtlasId: "quiz-feedback-animation-4", frameCount: 95, fps: 30, width: 480, height: 480 },
  { id: "animation-5", frameAtlasId: "quiz-feedback-animation-5", frameCount: 104, fps: 30, width: 640, height: 480 },
];

// Text questions cycle through these animations in this order. Keeping the
// order explicit lets the critical mobile preload follow the quiz sequence.
export const TEXT_QUIZ_FEEDBACK_MASCOTS: readonly QuizFeedbackMascotAnimation[] = [
  NORMAL_QUIZ_FEEDBACK_MASCOTS[4]!,
  NORMAL_QUIZ_FEEDBACK_MASCOTS[3]!,
  NORMAL_QUIZ_FEEDBACK_MASCOTS[1]!,
];

export const BONUS_QUIZ_FEEDBACK_MASCOT: QuizFeedbackMascotAnimation = {
  id: "Bonus-Celebration",
  frameAtlasId: "quiz-feedback-bonus-celebration",
  frameCount: 43,
  fps: 30,
  width: 480,
  height: 640,
};

export const QUIZ_FEEDBACK_MASCOT_CHANCE = 1 / 5;

const mascotFramePreloadCache = new Map<string, Promise<void>>();

const QUIZ_FEEDBACK_BAR_MASCOTS = NORMAL_QUIZ_FEEDBACK_MASCOTS.filter(
  (animation) => animation.id === "animation-1" || animation.id === "animation-3",
);

export function pickQuizFeedbackMascotAnimation(
  isBonus: boolean,
  chanceRoll = Math.random(),
  selectionRoll = Math.random(),
): QuizFeedbackMascotAnimation | null {
  if (chanceRoll >= QUIZ_FEEDBACK_MASCOT_CHANCE) return null;
  if (isBonus) return BONUS_QUIZ_FEEDBACK_MASCOT;

  const index = Math.min(
    NORMAL_QUIZ_FEEDBACK_MASCOTS.length - 1,
    Math.floor(selectionRoll * NORMAL_QUIZ_FEEDBACK_MASCOTS.length),
  );
  return NORMAL_QUIZ_FEEDBACK_MASCOTS[index] ?? null;
}

export function pickQuizFeedbackBarMascotAnimation(
  isBonus: boolean,
  isText: boolean,
  chanceRoll = Math.random(),
  selectionRoll = Math.random(),
): QuizFeedbackMascotAnimation | null {
  if (isBonus || isText || chanceRoll >= QUIZ_FEEDBACK_MASCOT_CHANCE) return null;

  const index = Math.min(
    QUIZ_FEEDBACK_BAR_MASCOTS.length - 1,
    Math.floor(selectionRoll * QUIZ_FEEDBACK_BAR_MASCOTS.length),
  );
  return QUIZ_FEEDBACK_BAR_MASCOTS[index] ?? null;
}

export function preloadQuizFeedbackMascotAnimation(
  animation: QuizFeedbackMascotAnimation,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const cacheKey = animation.frameAtlasId;
  const cached = mascotFramePreloadCache.get(cacheKey);
  if (cached) return cached;

  const preload = preloadVideoFrameAtlas(animation.frameAtlasId, 1).then(() => undefined);
  mascotFramePreloadCache.set(cacheKey, preload);
  return preload;
}

export function preloadTextQuizFeedbackMascots(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return Promise.all(
    TEXT_QUIZ_FEEDBACK_MASCOTS.map((animation) =>
      preloadQuizFeedbackMascotAnimation(animation),
    ),
  ).then(() => undefined);
}

export function QuizFeedbackMascotAnimationView({
  animation,
  onReady,
  onError,
}: {
  animation: QuizFeedbackMascotAnimation;
  onReady?: () => void;
  onError?: () => void;
}) {
  const readyNotifiedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readyNotifiedRef.current = false;
    setReady(false);
    void preloadQuizFeedbackMascotAnimation(animation).catch(() => undefined);
  }, [animation]);

  function handleFramesReady() {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    setReady(true);
    onReady?.();
  }

  function handleFramesError() {
    readyNotifiedRef.current = false;
    setReady(false);
    onError?.();
  }

  return (
    <div
      className="pointer-events-none relative z-0 isolate h-[clamp(5.5rem,24vw,9rem)] w-[clamp(6.5rem,30vw,11rem)] origin-bottom-left shrink-0 scale-[1.7]"
      style={{ aspectRatio: `${animation.width} / ${animation.height}` }}
      aria-hidden="true"
      data-quiz-feedback-mascot={animation.id}
      data-quiz-feedback-mascot-ready={ready}
    >
      <VideoFrameAtlasPlayer
        key={animation.id}
        assetId={animation.frameAtlasId}
        className="absolute inset-0 z-0 h-full w-full object-contain object-bottom"
        style={{ opacity: ready ? 1 : 0, zIndex: 0 }}
        autoPlay
        onReady={handleFramesReady}
        onError={handleFramesError}
        data-player-id={animation.id}
      />
    </div>
  );
}
