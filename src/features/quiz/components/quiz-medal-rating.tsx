"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { playSoundEffect, preloadSoundEffects } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { useQuizAnimationFastForward } from "@/features/quiz/components/quiz-animation-fast-forward";

interface QuizMedalRatingProps {
  rating: number;
  max?: number;
  className?: string;
  style?: CSSProperties;
  sequentialReveal?: boolean;
  onRevealComplete?: () => void;
}

const ARC_OFFSETS = [
  "translate-y-2",
  "translate-y-0",
  "-translate-y-2",
  "translate-y-0",
  "translate-y-2",
] as const;

const MEDAL_SIZES = [
  "size-9 sm:size-11",
  "size-[3rem] sm:size-[3.5rem]",
  "size-[3.5rem] sm:size-[4rem]",
  "size-[3rem] sm:size-[3.5rem]",
  "size-9 sm:size-11",
] as const;

const PANEL_REVEAL_DELAY_MS = 260;
const DROP_DURATION_MS = 500;
const STAGGER_MS = 120;
const PLACEHOLDER_REVEAL_DURATION_MS = 360;
const PLACEHOLDER_STAGGER_MS = 70;
const MEDAL_IMAGE_SRC = "/quiz/result-cards/star.webp?v=20261003-2";

export function QuizMedalRating({
  rating,
  max = 5,
  className,
  style,
  sequentialReveal = false,
  onRevealComplete,
}: QuizMedalRatingProps) {
  const clampedRating = Math.max(0, Math.min(max, Math.round(rating)));
  const revealStepMs = sequentialReveal ? DROP_DURATION_MS + STAGGER_MS : STAGGER_MS;
  const [ready, setReady] = useState(false);
  const [showEmpty, setShowEmpty] = useState(clampedRating === 0);
  const [fastForwarded, setFastForwarded] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const onRevealCompleteRef = useRef(onRevealComplete);
  const revealFinishedRef = useRef(false);
  const fastForwardedRef = useRef(false);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    if (!sequentialReveal || clampedRating === 0) return;
    preloadSoundEffects(["quiz-medal-reveal"]);
  }, [clampedRating, sequentialReveal]);

  useEffect(() => {
    if (fastForwarded) return;
    const timer = window.setTimeout(() => setReady(true), PANEL_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [fastForwarded]);

  const fastForwardReveal = useCallback(() => {
    if (!sequentialReveal || clampedRating === 0 || revealFinishedRef.current) return false;

    revealFinishedRef.current = true;
    fastForwardedRef.current = true;
    setFastForwarded(true);
    setReady(true);
    setShowEmpty(true);
    setRevealComplete(true);
    playSoundEffect("quiz-medal-reveal");
    onRevealCompleteRef.current?.();
    return true;
  }, [clampedRating, sequentialReveal]);

  useQuizAnimationFastForward(
    fastForwardReveal,
    sequentialReveal && clampedRating > 0 && !revealComplete,
    140,
  );

  useEffect(() => {
    if (clampedRating === 0 || fastForwarded) return;
    const lastFilledIndex = clampedRating - 1;
    const revealAt = PANEL_REVEAL_DELAY_MS + lastFilledIndex * revealStepMs + DROP_DURATION_MS;
    let completeTimer: number | null = null;
    const timer = window.setTimeout(() => {
      if (revealFinishedRef.current) return;
      setShowEmpty(true);
      playSoundEffect("quiz-medals-complete");
      const placeholderCount = Math.max(0, max - clampedRating);
      const placeholderRevealTime = placeholderCount > 0
        ? PLACEHOLDER_REVEAL_DURATION_MS + (placeholderCount - 1) * PLACEHOLDER_STAGGER_MS
        : 0;
      completeTimer = window.setTimeout(() => {
        if (revealFinishedRef.current) return;
        revealFinishedRef.current = true;
        setRevealComplete(true);
        onRevealCompleteRef.current?.();
      }, placeholderRevealTime);
    }, revealAt);
    return () => {
      window.clearTimeout(timer);
      if (completeTimer !== null) window.clearTimeout(completeTimer);
    };
  }, [clampedRating, fastForwarded, max, revealStepMs]);

  return (
    <div
      className={cn(
        "relative flex h-20 items-end justify-center gap-5 overflow-visible sm:h-24 sm:gap-6",
        className,
      )}
      style={style}
      role="img"
      aria-label={`${clampedRating} out of ${max} medals`}
      data-quiz-medal-rating
      data-quiz-medal-rating-value={clampedRating}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < clampedRating;
        const offset = ARC_OFFSETS[index];
        const sizeClass = MEDAL_SIZES[index];

        if (filled) {
          return (
            <div key={index} className={cn("flex shrink-0 items-end", offset)}>
              <Image
                src={MEDAL_IMAGE_SRC}
                alt=""
                width={64}
                height={64}
                className={cn(
                  sizeClass,
                  "origin-bottom",
                  "object-contain",
                  fastForwarded ? "opacity-100" : ready ? "animate-medal-drop" : "opacity-0",
                )}
                style={{
                  animationDelay: fastForwarded ? undefined : `${index * revealStepMs}ms`,
                }}
                onAnimationEnd={(event) => {
                  if (fastForwardedRef.current || event.animationName !== "star-drop") return;
                  playSoundEffect(sequentialReveal ? "quiz-medal-reveal" : "points", {
                    playbackRate: sequentialReveal ? 1 + index * 0.08 : 1,
                  });
                  vibrate("tap");
                }}
                data-quiz-medal="filled"
                data-quiz-medal-index={index}
              />
            </div>
          );
        }

        return (
          <div key={index} className={cn("flex shrink-0 items-end", offset)}>
            <div
              className={cn(
                "relative origin-bottom shrink-0",
                sizeClass,
                fastForwarded ? "opacity-100" : showEmpty ? "animate-medal-placeholder" : "opacity-0",
              )}
              style={{
                animationDelay: !fastForwarded && showEmpty
                  ? `${Math.max(0, index - clampedRating) * PLACEHOLDER_STAGGER_MS}ms`
                  : undefined,
              }}
              data-quiz-medal="empty"
              data-quiz-medal-index={index}
            >
              <Image
                src={MEDAL_IMAGE_SRC}
                alt=""
                fill
                sizes="4rem"
                className="object-contain"
                style={{
                  filter: "grayscale(1) brightness(0.45)",
                  opacity: 0.9,
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
