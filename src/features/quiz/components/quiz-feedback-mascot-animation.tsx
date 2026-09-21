"use client";

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

export function preloadQuizFeedbackMascotAnimation(
  animation: QuizFeedbackMascotAnimation,
) {
  if (typeof window === "undefined") return;

  for (let frame = 1; frame <= animation.frameCount; frame += 1) {
    const image = new window.Image();
    image.src = getQuizFeedbackMascotFramePath(animation, frame);
  }
}

function getQuizFeedbackMascotFramePath(
  animation: QuizFeedbackMascotAnimation,
  frame: number,
) {
  return `${MASCOT_BASE_PATH}/${animation.id}/${frame}.png`;
}

export function QuizFeedbackMascotAnimationView({
  animation,
}: {
  animation: QuizFeedbackMascotAnimation;
}) {
  const [frame, setFrame] = useState(1);

  useEffect(() => {
    let animationFrame = 0;
    const startedAt = window.performance.now();

    const advance = (now: number) => {
      const nextFrame = Math.min(
        animation.frameCount,
        Math.floor(((now - startedAt) * animation.fps) / 1000) + 1,
      );

      setFrame((currentFrame) => (currentFrame === nextFrame ? currentFrame : nextFrame));

      if (nextFrame < animation.frameCount) {
        animationFrame = window.requestAnimationFrame(advance);
      }
    };

    setFrame(1);
    animationFrame = window.requestAnimationFrame(advance);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [animation]);

  return (
    <div
      className="pointer-events-none relative h-[clamp(5.5rem,24vw,9rem)] w-[clamp(6.5rem,30vw,11rem)] shrink-0"
      style={{ aspectRatio: `${animation.width} / ${animation.height}` }}
      aria-hidden="true"
      data-quiz-feedback-mascot={animation.id}
      data-quiz-feedback-mascot-frame={frame}
    >
      <Image
        src={getQuizFeedbackMascotFramePath(animation, frame)}
        alt=""
        fill
        unoptimized
        loading="eager"
        sizes="(max-width: 640px) 30vw, 176px"
        className="object-contain object-bottom"
      />
    </div>
  );
}
