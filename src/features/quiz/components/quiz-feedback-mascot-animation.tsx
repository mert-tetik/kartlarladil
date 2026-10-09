"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";

export type QuizFeedbackMascotAnimation = {
  id: "animation-1" | "animation-2" | "animation-3" | "animation-4" | "animation-5" | "Bonus-Celebration";
  videoSrc: string;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
};

export const NORMAL_QUIZ_FEEDBACK_MASCOTS: readonly QuizFeedbackMascotAnimation[] = [
  { id: "animation-1", videoSrc: "/quiz-feedback-mascots-v1/animation-1.mp4?v=20261009-2", frameCount: 104, fps: 24, width: 480, height: 480 },
  { id: "animation-2", videoSrc: "/quiz-feedback-mascots-v1/animation-2.mp4?v=20261009-2", frameCount: 97, fps: 24, width: 752, height: 560 },
  { id: "animation-3", videoSrc: "/quiz-feedback-mascots-v1/animation-3.mp4?v=20261009-2", frameCount: 122, fps: 30, width: 640, height: 480 },
  { id: "animation-4", videoSrc: "/quiz-feedback-mascots-v1/animation-4.mp4?v=20261009-3", frameCount: 95, fps: 30, width: 480, height: 480 },
  { id: "animation-5", videoSrc: "/quiz-feedback-mascots-v1/animation-5.mp4?v=20261009-2", frameCount: 104, fps: 30, width: 640, height: 480 },
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
  videoSrc: "/quiz-feedback-mascots-v1/Bonus-Celebration.mp4?v=20261009-2",
  frameCount: 43,
  fps: 30,
  width: 480,
  height: 640,
};

export const QUIZ_FEEDBACK_MASCOT_CHANCE = 1 / 7;

const mascotVideoPreloadCache = new Map<string, Promise<void>>();
const preloadedMascotVideos = new Map<string, HTMLVideoElement>();

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

  const cacheKey = animation.videoSrc;
  const cached = mascotVideoPreloadCache.get(cacheKey);
  if (cached) return cached;

  const preload = new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;
    video.style.position = "fixed";
    video.style.left = "-2px";
    video.style.top = "-2px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";

    const cleanup = () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        // WebView media implementations can reject seeking before attachment.
      }
      resolve();
    };
    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      video.remove();
      reject(new Error(`Mascot video failed to load: ${animation.videoSrc}`));
    };

    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);
    video.src = animation.videoSrc;
    document.body.appendChild(video);
    preloadedMascotVideos.set(cacheKey, video);
    video.load();

    // Muted playback encourages Android WebView to decode the first frame
    // instead of stopping after metadata is available.
    try {
      void video.play().catch(() => undefined);
    } catch {
      // The load is still useful when autoplay is unavailable.
    }
  });

  const resilientPreload = preload.catch((error) => {
    // A transient WebView failure must be retryable on a later mount.
    mascotVideoPreloadCache.delete(cacheKey);
    preloadedMascotVideos.delete(cacheKey);
    throw error;
  });

  mascotVideoPreloadCache.set(cacheKey, resilientPreload);
  return resilientPreload;
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

  function handleVideoReady() {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    setReady(true);
    onReady?.();
  }

  function handleVideoError() {
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
      <video
        key={animation.id}
        className="absolute inset-0 z-[-1] h-full w-full object-contain object-bottom"
        style={{ opacity: ready ? 1 : 0 }}
        src={animation.videoSrc}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedData={handleVideoReady}
        onCanPlay={handleVideoReady}
        onError={handleVideoError}
        aria-hidden="true"
      />
    </div>
  );
}
