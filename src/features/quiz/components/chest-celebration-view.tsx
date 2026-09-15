"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";

interface ChestCelebrationViewProps {
  onComplete: () => void;
}

const CELEBRATION_MESSAGE_KEYS = [
  "quiz.chestCelebration1",
  "quiz.chestCelebration2",
  "quiz.chestCelebration3",
  "quiz.chestCelebration4",
] as const satisfies readonly string[];

const CELEBRATION_ENTER_DELAY_MS = 50;
const CELEBRATION_MESSAGE_EARLY_START_MS = 450;
const CELEBRATION_VIDEO_ERROR_FALLBACK_DELAY_MS = 750;
const CELEBRATION_MESSAGE_DELAY_MS = 1000;
const CELEBRATION_COMPLETE_DELAY_MS = 300;

export function ChestCelebrationView({ onComplete }: ChestCelebrationViewProps) {
  const { locale, t } = useLocale();
  const [viewVisible, setViewVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messageKey] = useState(() =>
    CELEBRATION_MESSAGE_KEYS[Math.floor(Math.random() * CELEBRATION_MESSAGE_KEYS.length)],
  );
  const completeRef = useRef(onComplete);
  const videoFinishedRef = useRef(false);
  const messageShownRef = useRef(false);
  const earlyMessageTimerRef = useRef<number | null>(null);
  const videoErrorTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const showMessage = () => {
    if (messageShownRef.current) return;
    messageShownRef.current = true;
    setMessageVisible(true);
  };

  const closeView = () => {
    setMessageVisible(false);
    setClosing(true);
    completeTimerRef.current = window.setTimeout(
      () => completeRef.current?.(),
      CELEBRATION_COMPLETE_DELAY_MS,
    );
  };

  const finishVideo = () => {
    if (videoFinishedRef.current) return;
    videoFinishedRef.current = true;
    if (earlyMessageTimerRef.current !== null) {
      window.clearTimeout(earlyMessageTimerRef.current);
    }
    showMessage();
    messageTimerRef.current = window.setTimeout(() => {
      closeView();
    }, CELEBRATION_MESSAGE_DELAY_MS);
  };

  const handleVideoLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (!Number.isFinite(video.duration)) return;
    earlyMessageTimerRef.current = window.setTimeout(
      showMessage,
      Math.max(0, video.duration * 1000 - CELEBRATION_MESSAGE_EARLY_START_MS),
    );
  };

  const handleVideoError = () => {
    if (videoErrorTimerRef.current !== null) return;
    videoErrorTimerRef.current = window.setTimeout(
      finishVideo,
      CELEBRATION_VIDEO_ERROR_FALLBACK_DELAY_MS,
    );
  };

  useEffect(() => {
    const enterTimer = window.setTimeout(
      () => setViewVisible(true),
      CELEBRATION_ENTER_DELAY_MS,
    );

    return () => {
      window.clearTimeout(enterTimer);
      if (earlyMessageTimerRef.current !== null) {
        window.clearTimeout(earlyMessageTimerRef.current);
      }
      if (videoErrorTimerRef.current !== null) {
        window.clearTimeout(videoErrorTimerRef.current);
      }
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--background)] p-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        closing
          ? "scale-[1.025] opacity-0"
          : viewVisible
            ? "scale-100 opacity-100"
            : "scale-[1.025] opacity-100",
      )}
      data-chest-celebration-view
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--background)]"
        aria-hidden="true"
        data-chest-celebration-background
      >
        <video
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ease-linear",
            viewVisible ? "opacity-100" : "opacity-0",
          )}
          src="/quiz/result_message_video.mp4"
          autoPlay
          muted
          onEnded={finishVideo}
          onError={handleVideoError}
          onLoadedMetadata={handleVideoLoadedMetadata}
          playsInline
          preload="auto"
          data-chest-celebration-video
        />
      </div>
      <div
        className={cn(
          "relative z-10 flex max-w-[22rem] items-center justify-center text-center sm:max-w-xl",
          closing
            ? "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] scale-[1.025] opacity-0"
            : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          messageVisible && !closing
            ? "translate-y-0 opacity-100"
            : !closing && "-translate-y-6 opacity-0",
        )}
      >
        <p
          className={cn(
            "text-balance text-5xl font-bold uppercase leading-tight text-white [filter:grayscale(1)_brightness(0)_invert(1)] sm:text-7xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
          data-chest-celebration-message
        >
          {formatSuperWaterUppercaseText(locale, t(messageKey))}
        </p>
      </div>
    </div>
  );
}
