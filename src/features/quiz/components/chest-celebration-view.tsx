"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import Image from "next/image";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { getNativeMediaFallbackSource, isNativeMediaFallbackSource } from "@/lib/native-media-fallback";
import { playSoundEffect } from "@/lib/sound-effects";
import { AchievementCardSection } from "@/features/quiz/components/quiz-achievement-card-section";
import type { VocabularyCard } from "@/types/domain";

interface ChestCelebrationViewProps {
  onComplete: () => void;
  onResultActionPress?: () => void;
  learnedCards?: readonly VocabularyCard[];
  advancedCards?: readonly VocabularyCard[];
  advancedCardProgress?: Readonly<Record<string, number>>;
  preserveMessageOnComplete?: boolean;
}

const CELEBRATION_MESSAGE_KEYS = [
  "quiz.chestCelebration1",
  "quiz.chestCelebration2",
  "quiz.chestCelebration3",
  "quiz.chestCelebration4",
] as const satisfies readonly string[];

const CELEBRATION_ENTER_DELAY_MS = 50;
const CELEBRATION_MESSAGE_EARLY_START_MS = 650;
const CELEBRATION_VIDEO_ERROR_FALLBACK_DELAY_MS = 750;
const CELEBRATION_MESSAGE_DELAY_MS = 1000;
const CELEBRATION_MESSAGE_EXIT_DURATION_MS = 420;
const RESULT_SUMMARY_PANEL_ENTER_DURATION_MS = 1400;
const RESULT_SUMMARY_CONTENT_DELAY_MS = 80;
const CELEBRATION_COMPLETE_DELAY_MS = 500;
const RESULT_MESSAGE_WAVE_SRC = "/quiz/result-message-wave-20261003-1.png";
const RESULT_MESSAGE_WAVE_HEIGHT_CSS = "177.9167vw";
const RESULT_MESSAGE_ACHIEVEMENT_ENTER_DURATION_MS = 620;
const RESULT_MESSAGE_PARTICLE_SRC = "/quiz/result-message-bubble.png?v=20261008-1";
const RESULT_MESSAGE_PARTICLE_COUNT = 30;
const RESULT_MESSAGE_PARTICLE_REVEAL_LEAD_MS = 80;
const RESULT_MESSAGE_PARTICLE_SPAWN_RECT = {
  leftPercent: 32,
  topPercent: 34,
  widthPercent: 36,
  heightPercent: 32,
} as const;

type ResultMessageParticle = {
  originX: number;
  originY: number;
  quarterX: number;
  quarterY: number;
  midX: number;
  midY: number;
  threeQuarterX: number;
  threeQuarterY: number;
  x: number;
  y: number;
  rotation: number;
  midRotation: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

function createResultMessageParticles(): ResultMessageParticle[] {
  return Array.from({ length: RESULT_MESSAGE_PARTICLE_COUNT }, () => {
    const durationSeconds = 1 + Math.random() * 0.15;
    const velocityX = (Math.random() * 2 - 1) * 160;
    const velocityYBase = -190 + Math.random() * 270;
    const velocityY = velocityYBase < 0 ? velocityYBase * 1.6 : velocityYBase;
    const gravity = 280 + Math.random() * 60;
    const getPosition = (timeSeconds: number) => ({
      x: velocityX * timeSeconds,
      y: velocityY * timeSeconds + 0.5 * gravity * timeSeconds ** 2,
    });
    const quarter = getPosition(durationSeconds * 0.25);
    const midpoint = getPosition(durationSeconds * 0.5);
    const threeQuarter = getPosition(durationSeconds * 0.75);
    const end = getPosition(durationSeconds);

    return {
      originX:
        RESULT_MESSAGE_PARTICLE_SPAWN_RECT.leftPercent
        + Math.random() * RESULT_MESSAGE_PARTICLE_SPAWN_RECT.widthPercent,
      originY:
        RESULT_MESSAGE_PARTICLE_SPAWN_RECT.topPercent
        + Math.random() * RESULT_MESSAGE_PARTICLE_SPAWN_RECT.heightPercent,
      quarterX: quarter.x,
      quarterY: quarter.y,
      midX: midpoint.x,
      midY: midpoint.y,
      threeQuarterX: threeQuarter.x,
      threeQuarterY: threeQuarter.y,
      x: end.x,
      y: end.y,
      rotation: (Math.random() - 0.5) * 180,
      midRotation: (Math.random() - 0.5) * 80,
      size: 11 + Math.round(Math.random() * 10),
      duration: Math.round(durationSeconds * 1000),
      delay: Math.round(Math.random() * 45),
      opacity: 0.3 + Math.random() * 0.7,
    };
  });
}

export function ChestCelebrationView({
  onComplete,
  onResultActionPress,
  learnedCards = [],
  advancedCards = [],
  advancedCardProgress,
  preserveMessageOnComplete = false,
}: ChestCelebrationViewProps) {
  const { locale, t } = useLocale();
  const [viewVisible, setViewVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [summaryPanelVisible, setSummaryPanelVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryExiting, setSummaryExiting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [videoSource, setVideoSource] = useState(
    "/quiz/result_message_video.mp4?v=20261008-1",
  );
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [messageParticles, setMessageParticles] = useState<ResultMessageParticle[]>([]);
  const [messageKey] = useState(() =>
    CELEBRATION_MESSAGE_KEYS[Math.floor(Math.random() * CELEBRATION_MESSAGE_KEYS.length)],
  );
  const completeRef = useRef(onComplete);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoFinishedRef = useRef(false);
  const messageShownRef = useRef(false);
  const earlyMessageTimerRef = useRef<number | null>(null);
  const videoErrorTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const summaryTimerRef = useRef<number | null>(null);
  const summaryContentTimerRef = useRef<number | null>(null);
  const summaryMessageHideTimerRef = useRef<number | null>(null);
  const summaryAutoCompleteTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const messageRevealTimerRef = useRef<number | null>(null);
  const completionStartedRef = useRef(false);
  const messageRevealHandledRef = useRef(false);
  const hasSummaryCards = learnedCards.length > 0 || advancedCards.length > 0;

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const showMessage = () => {
    if (messageShownRef.current) return;
    messageShownRef.current = true;
    setMessageVisible(true);
  };

  const revealMessageParticles = useCallback(() => {
    if (messageRevealHandledRef.current) return;
    messageRevealHandledRef.current = true;
    playSoundEffect("streak-count-reveal", { playbackRate: 0.8 });
    setMessageParticles(createResultMessageParticles());
  }, []);

  useEffect(() => {
    if (!messageVisible || closing) return;

    if (messageRevealTimerRef.current !== null) {
      window.clearTimeout(messageRevealTimerRef.current);
    }

    messageRevealTimerRef.current = window.setTimeout(() => {
      messageRevealTimerRef.current = null;
      revealMessageParticles();
    }, RESULT_MESSAGE_ACHIEVEMENT_ENTER_DURATION_MS - RESULT_MESSAGE_PARTICLE_REVEAL_LEAD_MS);

    return () => {
      if (messageRevealTimerRef.current !== null) {
        window.clearTimeout(messageRevealTimerRef.current);
        messageRevealTimerRef.current = null;
      }
    };
  }, [closing, messageVisible, revealMessageParticles]);

  const completeView = useCallback(() => {
    if (completionStartedRef.current) return;
    completionStartedRef.current = true;

    if (preserveMessageOnComplete) {
      setSummaryExiting(true);
      setSummaryVisible(false);
    } else {
      setClosing(true);
    }

    completeTimerRef.current = window.setTimeout(
      () => completeRef.current?.(),
      preserveMessageOnComplete && !hasSummaryCards
        ? 0
        : CELEBRATION_COMPLETE_DELAY_MS,
    );
  }, [hasSummaryCards, preserveMessageOnComplete]);

  const showSummary = () => {
    summaryTimerRef.current = window.setTimeout(() => {
      summaryTimerRef.current = null;
      setSummaryPanelVisible(true);
      summaryMessageHideTimerRef.current = window.setTimeout(() => {
        summaryMessageHideTimerRef.current = null;
        setMessageVisible(false);
      }, RESULT_SUMMARY_PANEL_ENTER_DURATION_MS);
      if (hasSummaryCards) {
        summaryContentTimerRef.current = window.setTimeout(() => {
          summaryContentTimerRef.current = null;
          setSummaryVisible(true);
        }, RESULT_SUMMARY_PANEL_ENTER_DURATION_MS + RESULT_SUMMARY_CONTENT_DELAY_MS);
      }
    }, CELEBRATION_MESSAGE_EXIT_DURATION_MS);
  };

  const closeView = () => {
    if (!summaryVisible || closing) return;
    onResultActionPress?.();
    if (!onResultActionPress) {
      playSoundEffect("result-action-press");
    }
    completeView();
  };

  useEffect(() => {
    if (!preserveMessageOnComplete || hasSummaryCards || !summaryPanelVisible) return;

    summaryAutoCompleteTimerRef.current = window.setTimeout(
      () => {
        summaryAutoCompleteTimerRef.current = null;
        completeView();
      },
      RESULT_SUMMARY_PANEL_ENTER_DURATION_MS,
    );

    return () => {
      if (summaryAutoCompleteTimerRef.current !== null) {
        window.clearTimeout(summaryAutoCompleteTimerRef.current);
        summaryAutoCompleteTimerRef.current = null;
      }
    };
  }, [completeView, hasSummaryCards, preserveMessageOnComplete, summaryPanelVisible]);

  const finishVideo = () => {
    if (videoFinishedRef.current) return;
    videoFinishedRef.current = true;
    audioRef.current?.pause();
    if (earlyMessageTimerRef.current !== null) {
      window.clearTimeout(earlyMessageTimerRef.current);
    }
    showMessage();
    messageTimerRef.current = window.setTimeout(() => {
      messageTimerRef.current = null;
      showSummary();
    }, CELEBRATION_MESSAGE_DELAY_MS);
  };

  const startSynchronizedAudio = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    try {
      audio.currentTime = video.currentTime;
    } catch {
      // Seeking the separate audio track is best effort on older WebViews.
    }
    audio.volume = 1;
    void audio.play().catch(() => undefined);
  };

  const syncSynchronizedAudio = (event: SyntheticEvent<HTMLVideoElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - event.currentTarget.currentTime) > 0.18) {
      try {
        audio.currentTime = event.currentTarget.currentTime;
      } catch {
        // Keep the video usable if a WebView rejects a seek during startup.
      }
    }
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
    if (!isNativeMediaFallbackSource(videoSource)) {
      setVideoSource(getNativeMediaFallbackSource(videoSource));
      return;
    }
    setVideoUnavailable(true);
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
      if (summaryTimerRef.current !== null) {
        window.clearTimeout(summaryTimerRef.current);
      }
      if (summaryContentTimerRef.current !== null) {
        window.clearTimeout(summaryContentTimerRef.current);
      }
      if (summaryMessageHideTimerRef.current !== null) {
        window.clearTimeout(summaryMessageHideTimerRef.current);
      }
      if (summaryAutoCompleteTimerRef.current !== null) {
        window.clearTimeout(summaryAutoCompleteTimerRef.current);
      }
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
      }
      if (messageRevealTimerRef.current !== null) {
        window.clearTimeout(messageRevealTimerRef.current);
      }
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--background)] p-4 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        closing
          ? "opacity-0"
          : viewVisible
            ? "opacity-100"
            : "opacity-0",
      )}
      data-chest-celebration-view
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--background)]"
        aria-hidden="true"
        data-chest-celebration-background
      >
        {!videoUnavailable ? <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            viewVisible ? "opacity-100" : "opacity-0",
          )}
          key={videoSource}
          src={videoSource}
          autoPlay
          muted
          playsInline
          onEnded={finishVideo}
          onPlay={startSynchronizedAudio}
          onError={handleVideoError}
          onLoadedMetadata={handleVideoLoadedMetadata}
          onTimeUpdate={syncSynchronizedAudio}
          preload="auto"
          data-chest-celebration-video
        /> : null}
        <audio
          ref={audioRef}
          src="/quiz/result-message-video-audio.m4a?v=20261007-2"
          preload="auto"
          aria-hidden="true"
        />
      </div>
      <div
        className={cn(
          "relative z-10 flex max-w-[22rem] items-center justify-center text-center sm:max-w-xl",
          closing
            ? "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] scale-[1.025] opacity-0"
            : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          messageVisible && !closing ? "translate-y-0 opacity-100" : !closing && "-translate-y-6 opacity-0",
        )}
      >
        <p
          className={cn(
            "relative text-balance text-5xl font-bold uppercase leading-tight text-white [filter:grayscale(1)_brightness(0)_invert(1)] sm:text-7xl",
            messageVisible && !closing && "result-message-achievement-enter",
            canUseSuperWater(locale) && "font-super-water",
          )}
          onAnimationEnd={revealMessageParticles}
          data-chest-celebration-message
        >
          <span className="relative z-10">
            {formatSuperWaterUppercaseText(locale, t(messageKey))}
          </span>
          {messageParticles.length > 0 ? (
            <span
              className="result-message-particle-layer pointer-events-none absolute inset-0 z-0 overflow-visible"
              aria-hidden="true"
            >
              {messageParticles.map((particle, index) => (
                <span
                  key={index}
                  className="result-message-particle absolute block bg-contain bg-center bg-no-repeat"
                  style={{
                    left: `${particle.originX}%`,
                    top: `${particle.originY}%`,
                    width: particle.size,
                    height: particle.size,
                    backgroundImage: `url("${RESULT_MESSAGE_PARTICLE_SRC}")`,
                    animationDuration: `${particle.duration}ms`,
                    animationDelay: `${particle.delay}ms`,
                    "--result-message-particle-quarter-x": `${particle.quarterX}px`,
                    "--result-message-particle-quarter-y": `${particle.quarterY}px`,
                    "--result-message-particle-x": `${particle.x}px`,
                    "--result-message-particle-y": `${particle.y}px`,
                    "--result-message-particle-mid-x": `${particle.midX}px`,
                    "--result-message-particle-mid-y": `${particle.midY}px`,
                    "--result-message-particle-three-quarter-x": `${particle.threeQuarterX}px`,
                    "--result-message-particle-three-quarter-y": `${particle.threeQuarterY}px`,
                    "--result-message-particle-rotation": `${particle.rotation}deg`,
                    "--result-message-particle-mid-rotation": `${particle.midRotation}deg`,
                    "--result-message-particle-opacity": particle.opacity,
                  } as CSSProperties}
                />
              ))}
            </span>
          ) : null}
        </p>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 overflow-visible bg-[var(--background)] transform-gpu transition-transform duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{
          transform: closing
            ? "translateY(100%)"
            : summaryPanelVisible
              ? "translateY(0)"
              : `translateY(calc(100% + ${RESULT_MESSAGE_WAVE_HEIGHT_CSS}))`,
        }}
        data-quiz-result-summary-panel
      >
        <Image
          src={RESULT_MESSAGE_WAVE_SRC}
          alt=""
          aria-hidden="true"
          width={480}
          height={854}
          sizes="100vw"
          className={cn(
            "pointer-events-none absolute bottom-full left-0 z-0 block h-auto w-full max-w-none select-none opacity-100",
          )}
        />
        <div
          className={cn(
            "absolute inset-x-0 top-0 bottom-20 overflow-hidden px-4 pb-8 pt-8 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 sm:pt-10",
            summaryVisible && !closing
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0",
          )}
          data-chest-celebration-summary
        >
          <div className="pointer-events-auto h-full min-h-0 w-full overflow-y-auto overscroll-contain">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 p-4 sm:p-6">
              {learnedCards.length > 0 ? (
                <AchievementCardSection
                  title={t("quiz.resultLearned")}
                  cards={learnedCards}
                  tone="learned"
                  reveal={summaryVisible}
                  exiting={summaryExiting}
                  staggerOffsetMs={0}
                />
              ) : null}
              {advancedCards.length > 0 ? (
                <AchievementCardSection
                  title={t("quiz.resultAdvanced")}
                  cards={advancedCards}
                  tone="advanced"
                  progressByCardId={advancedCardProgress}
                  reveal={summaryVisible}
                  exiting={summaryExiting}
                  staggerOffsetMs={learnedCards.length > 0 ? 850 : 0}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-8">
          <button
            type="button"
            onClick={closeView}
            disabled={!summaryVisible || closing}
            className={cn(
              "pointer-events-auto mx-auto block h-14 w-full max-w-md rounded-2xl bg-brand px-5 text-lg font-bold uppercase text-brand-foreground shadow-[0_6px_0_var(--brand-hover)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none sm:h-16",
              canUseSuperWater(locale) && "font-super-water",
              summaryVisible && !closing ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            )}
          >
            {formatSuperWaterUppercaseText(locale, t("quiz.continue"))}
          </button>
        </div>
      </div>
    </div>
  );
}
