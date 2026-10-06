"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { useEffect, useState } from "react";

export type QuizFeedbackMascotAnimation = {
  id: "animation-1" | "animation-2" | "animation-3" | "animation-4" | "animation-5" | "Bonus-Celebration";
  frameCount: number;
  fps: number;
  width: number;
  height: number;
};

const MASCOT_BASE_PATH = "/quiz-feedback-mascots-v1";

export const NORMAL_QUIZ_FEEDBACK_MASCOTS: readonly QuizFeedbackMascotAnimation[] = [
  { id: "animation-1", frameCount: 104, fps: 24, width: 480, height: 480 },
  { id: "animation-2", frameCount: 97, fps: 24, width: 752, height: 560 },
  { id: "animation-3", frameCount: 122, fps: 30, width: 640, height: 480 },
  { id: "animation-4", frameCount: 95, fps: 30, width: 480, height: 480 },
  { id: "animation-5", frameCount: 104, fps: 30, width: 640, height: 480 },
];

export const BONUS_QUIZ_FEEDBACK_MASCOT: QuizFeedbackMascotAnimation = {
  id: "Bonus-Celebration",
  frameCount: 43,
  fps: 30,
  width: 480,
  height: 640,
};

export const QUIZ_FEEDBACK_MASCOT_CHANCE = 1 / 7;

const mascotAnimationPreloadCache = new Map<string, Promise<void>>();

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

  const cacheKey = `${animation.id}:${animation.frameCount}`;
  const cached = mascotAnimationPreloadCache.get(cacheKey);
  if (cached) return cached;

  const preload = Promise.all(
    Array.from({ length: animation.frameCount }, (_, index) => {
      const image = new window.Image();
      const source = getQuizFeedbackMascotFramePath(animation, index + 1);

      return new Promise<void>((resolve, reject) => {
        image.onload = () => {
          const decode = image.decode?.();
          if (decode) {
            void decode.then(() => resolve()).catch(() => resolve());
          } else {
            resolve();
          }
        };
        image.onerror = () => reject(new Error(`Mascot frame failed to load: ${source}`));
        image.src = source;
      });
    }),
  ).then(() => undefined);

  mascotAnimationPreloadCache.set(cacheKey, preload);
  return preload;
}

function getQuizFeedbackMascotFramePath(
  animation: QuizFeedbackMascotAnimation,
  frame: number,
) {
  return `${MASCOT_BASE_PATH}/${animation.id}/${frame}.png`;
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
  const [frame, setFrame] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    setReady(false);
    setFrame(1);

    void preloadQuizFeedbackMascotAnimation(animation)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        onReady?.();
        const startedAt = window.performance.now();

        const advance = (now: number) => {
          if (cancelled) return;
          const nextFrame = Math.min(
            animation.frameCount,
            Math.floor(((now - startedAt) * animation.fps) / 1000) + 1,
          );

          setFrame((currentFrame) => (currentFrame === nextFrame ? currentFrame : nextFrame));

          if (nextFrame < animation.frameCount) {
            animationFrame = window.requestAnimationFrame(advance);
          }
        };

        animationFrame = window.requestAnimationFrame(advance);
      })
      .catch(() => {
        if (!cancelled) onError?.();
      });

    return () => {
      cancelled = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [animation, onError, onReady]);

  return (
    <div
      className="pointer-events-none relative h-[clamp(5.5rem,24vw,9rem)] w-[clamp(6.5rem,30vw,11rem)] origin-bottom-left shrink-0 scale-[1.7]"
      style={{ aspectRatio: `${animation.width} / ${animation.height}` }}
      aria-hidden="true"
      data-quiz-feedback-mascot={animation.id}
      data-quiz-feedback-mascot-frame={frame}
      data-quiz-feedback-mascot-ready={ready}
    >
      {ready ? (
        <div className="absolute inset-0">
          <Image
            src={getQuizFeedbackMascotFramePath(animation, frame)}
            alt=""
            fill
            unoptimized
            loading="eager"
            sizes="(max-width: 640px) 30vw, 176px"
            className="object-contain object-bottom [filter:contrast(1.12)]"
          />
        </div>
      ) : null}
    </div>
  );
}
