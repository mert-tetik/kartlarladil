"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardProgressGemRewardAction } from "@/features/gems/gem-actions";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import { formatNumber } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { getNativeMediaFallbackSource, isNativeMediaFallbackSource } from "@/lib/native-media-fallback";

interface QuizStreakRewardViewProps {
  streak: number;
  points: number;
  totalPoints: number;
  quizSessionId?: string;
  testMode?: boolean;
  testGemRewards?: GemRewards;
  testGemBalances?: GemBalances;
  onComplete: () => void;
}

const STREAK_REWARD_INTRO_VIDEO_SOURCE =
  "/quiz/streak-reward-background-20260921-intro.mp4?v=20261007-1";
const STREAK_REWARD_CONTINUATION_VIDEO_SOURCE =
  "/quiz/streak-reward-background-20260921-continuation.mp4?v=20261007-1";
const VIDEO_AUDIO_FADE_IN_DURATION_MS = 500;
const VIDEO_AUDIO_FADE_OUT_DURATION_MS = 2000;
const VIDEO_AUDIO_MAX_VOLUME = 0.75;
const VIDEO_FADE_OUT_DURATION_MS = 250;
const STREAK_REWARD_CONTINUATION_DURATION_MS = 1933;
const POST_VIDEO_HOLD_DURATION_MS = 1000;
const UI_EXIT_DELAY_AFTER_VIDEO_MS = 700;
const MEDIA_FALLBACK_DELAY_MS = STREAK_REWARD_CONTINUATION_DURATION_MS + 2000;

export function QuizStreakRewardView({
  streak,
  points,
  totalPoints,
  quizSessionId,
  testMode = false,
  testGemRewards = [],
  testGemBalances = { blue: 50, green: 30, purple: 15 },
  onComplete,
}: QuizStreakRewardViewProps) {
  const { locale, t } = useLocale();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const rewardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const continuationVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const breakTimerRef = useRef<number | null>(null);
  const audioFadeInFrameRef = useRef<number | null>(null);
  const audioFadeOutTimerRef = useRef<number | null>(null);
  const audioFadeOutFrameRef = useRef<number | null>(null);
  const uiExitTimerRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const hardCompletionTimeoutRef = useRef<number | null>(null);
  const rewardStartedRef = useRef(false);
  const breakStartedRef = useRef(false);
  const interactionStartedRef = useRef(false);
  const audioFadeInStartedRef = useRef(false);
  const audioFadeOutStartedRef = useRef(false);
  const videoPlaybackStartedRef = useRef(false);
  const introAudioStartedRef = useRef(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [gemRewards, setGemRewards] = useState<GemRewards>([]);
  const [rewardStarted, setRewardStarted] = useState(false);
  const [videoExiting, setVideoExiting] = useState(false);
  const [introVideoSource, setIntroVideoSource] = useState(STREAK_REWARD_INTRO_VIDEO_SOURCE);
  const [continuationVideoSource, setContinuationVideoSource] = useState(
    STREAK_REWARD_CONTINUATION_VIDEO_SOURCE,
  );
  const [introVideoUnavailable, setIntroVideoUnavailable] = useState(false);
  const [continuationVideoUnavailable, setContinuationVideoUnavailable] = useState(false);
  const [continuationVisible, setContinuationVisible] = useState(false);
  const [uiExiting, setUiExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const gemFinalBalancesRef = useRef<GemBalances | null>(null);
  const {
    balances: gemDisplayBalances,
    pulse: gemPulse,
    prepare: prepareGemRewardDisplay,
    handleGemArrive,
    finish: finishGemRewardDisplay,
  } = useGemRewardDisplay();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // This state gates the document.body portal and intentionally runs once on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (testMode) {
      gemFinalBalancesRef.current = testGemBalances;
      prepareGemRewardDisplay(testGemBalances, testGemRewards);
      // Test rewards are synchronized into the local display when the test inputs change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGemRewards(testGemRewards);
      return;
    }

    if (!user || !quizSessionId || streak <= 0) return;
    let active = true;

    void awardProgressGemRewardAction({
      source: "quiz-streak",
      claimKey: `quiz-streak:${quizSessionId}`,
      streak,
    }).then((result) => {
      if (!active || !result.success) return;
      const rewards = result.awarded ? result.rewards ?? [] : [];
      if (result.balances) {
        gemFinalBalancesRef.current = result.balances;
        prepareGemRewardDisplay(result.balances, rewards);
        updateProfileField({
          blueGems: result.balances.blue,
          greenGems: result.balances.green,
          purpleGems: result.balances.purple,
        });
      }
      if (result.awarded && result.rewards?.length) setGemRewards(result.rewards);
    });

    return () => {
      active = false;
    };
  }, [prepareGemRewardDisplay, quizSessionId, streak, testGemBalances, testGemRewards, testMode, updateProfileField, user]);

  const forceComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  const startRewardScatter = useCallback(() => {
    if (rewardStartedRef.current) return;
    rewardStartedRef.current = true;

    setRewardStarted(true);
    vibrate("streak-reward-tap");
  }, []);

  const startVideoAudioFadeIn = useCallback((video: HTMLVideoElement) => {
    if (!video || audioFadeInStartedRef.current || audioFadeOutStartedRef.current) return;

    audioFadeInStartedRef.current = true;
    if (audioFadeInFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFadeInFrameRef.current);
      audioFadeInFrameRef.current = null;
    }

    video.volume = 0;
    const startedAt = performance.now();
    const fade = (timestamp: number) => {
      const progress = Math.min(
        1,
        (timestamp - startedAt) / VIDEO_AUDIO_FADE_IN_DURATION_MS,
      );
      video.volume = VIDEO_AUDIO_MAX_VOLUME * progress;

      if (progress < 1) {
        audioFadeInFrameRef.current = window.requestAnimationFrame(fade);
      } else {
        audioFadeInFrameRef.current = null;
        video.volume = VIDEO_AUDIO_MAX_VOLUME;
      }
    };

    audioFadeInFrameRef.current = window.requestAnimationFrame(fade);
  }, []);

  const startVideoAudioFadeOut = useCallback(() => {
    const video = activeVideoRef.current;
    if (!video || audioFadeOutStartedRef.current) return;

    audioFadeOutStartedRef.current = true;
    if (audioFadeOutTimerRef.current !== null) {
      window.clearTimeout(audioFadeOutTimerRef.current);
      audioFadeOutTimerRef.current = null;
    }
    if (audioFadeInFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFadeInFrameRef.current);
      audioFadeInFrameRef.current = null;
    }
    if (audioFadeOutFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFadeOutFrameRef.current);
      audioFadeOutFrameRef.current = null;
    }

    const initialVolume = video.volume;
    const startedAt = performance.now();
    const fade = (timestamp: number) => {
      const progress = Math.min(
        1,
        (timestamp - startedAt) / VIDEO_AUDIO_FADE_OUT_DURATION_MS,
      );
      video.volume = Math.max(0, initialVolume * (1 - progress));

      if (progress < 1) {
        audioFadeOutFrameRef.current = window.requestAnimationFrame(fade);
      } else {
        audioFadeOutFrameRef.current = null;
        video.volume = 0;
      }
    };

    audioFadeOutFrameRef.current = window.requestAnimationFrame(fade);
  }, []);

  const startBreak = useCallback(() => {
    if (breakStartedRef.current) return;
    breakStartedRef.current = true;

    if (!rewardStartedRef.current) startRewardScatter();
    startVideoAudioFadeOut();
    if (breakTimerRef.current !== null) {
      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    if (hardCompletionTimeoutRef.current !== null) {
      window.clearTimeout(hardCompletionTimeoutRef.current);
      hardCompletionTimeoutRef.current = null;
    }
    setVideoExiting(true);
    uiExitTimerRef.current = window.setTimeout(() => {
      setUiExiting(true);
    }, VIDEO_FADE_OUT_DURATION_MS + UI_EXIT_DELAY_AFTER_VIDEO_MS);
    completionTimeoutRef.current = window.setTimeout(() => {
      forceComplete();
    }, VIDEO_FADE_OUT_DURATION_MS + POST_VIDEO_HOLD_DURATION_MS);
  }, [forceComplete, startRewardScatter, startVideoAudioFadeOut]);

  const scheduleVideoFade = useCallback(() => {
    const video = activeVideoRef.current;
    if (
      breakStartedRef.current ||
      !videoPlaybackStartedRef.current ||
      !video ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    if (breakTimerRef.current !== null) {
      window.clearTimeout(breakTimerRef.current);
    }

    const remainingMs = Math.max(0, (video.duration - video.currentTime) * 1000);
    if (!audioFadeOutStartedRef.current) {
      if (remainingMs <= VIDEO_AUDIO_FADE_OUT_DURATION_MS) {
        startVideoAudioFadeOut();
      } else {
        if (audioFadeOutTimerRef.current !== null) {
          window.clearTimeout(audioFadeOutTimerRef.current);
        }
        audioFadeOutTimerRef.current = window.setTimeout(
          startVideoAudioFadeOut,
          remainingMs - VIDEO_AUDIO_FADE_OUT_DURATION_MS,
        );
      }
    }

    breakTimerRef.current = window.setTimeout(
      startBreak,
      Math.max(0, remainingMs - VIDEO_FADE_OUT_DURATION_MS),
    );
  }, [startBreak, startVideoAudioFadeOut]);

  const handleIntroVideoPlay = useCallback(() => {
    const video = introVideoRef.current;
    if (!video) return;

    activeVideoRef.current = video;
    videoPlaybackStartedRef.current = true;
    startVideoAudioFadeIn(video);
    if (!introAudioStartedRef.current && introAudioRef.current) {
      introAudioStartedRef.current = true;
      try {
        introAudioRef.current.currentTime = video.currentTime;
      } catch {
        // Audio/video synchronization is best effort on older WebViews.
      }
      void introAudioRef.current.play().catch(() => undefined);
    }
  }, [startVideoAudioFadeIn]);

  const handleContinuationVideoPlay = useCallback(() => {
    const video = continuationVideoRef.current;
    if (!video) return;

    activeVideoRef.current = video;
    videoPlaybackStartedRef.current = true;
    video.volume = VIDEO_AUDIO_MAX_VOLUME;
    if (interactionStartedRef.current) {
      scheduleVideoFade();
    }
  }, [scheduleVideoFade]);

  const handleContinuationVideoTimeUpdate = useCallback(() => {
    if (interactionStartedRef.current) scheduleVideoFade();
  }, [scheduleVideoFade]);

  const handleContinuationVideoEnded = useCallback(() => {
    startBreak();
  }, [startBreak]);

  const handleIntroVideoError = useCallback(() => {
    if (!isNativeMediaFallbackSource(introVideoSource)) {
      setIntroVideoSource(getNativeMediaFallbackSource(introVideoSource));
      return;
    }
    setIntroVideoUnavailable(true);
  }, [introVideoSource]);

  const handleContinuationVideoError = useCallback(() => {
    if (!isNativeMediaFallbackSource(continuationVideoSource)) {
      setContinuationVideoSource(getNativeMediaFallbackSource(continuationVideoSource));
      return;
    }
    setContinuationVideoUnavailable(true);
    if (interactionStartedRef.current) startBreak();
  }, [continuationVideoSource, startBreak]);

  const handleScreenActivate = useCallback(() => {
    if (completedRef.current || interactionStartedRef.current) return;

    const introVideo = introVideoRef.current;
    if (introVideo && !introVideo.paused && !introVideo.ended) return;

    interactionStartedRef.current = true;
    startRewardScatter();

    hardCompletionTimeoutRef.current = window.setTimeout(() => {
      hardCompletionTimeoutRef.current = null;
      if (!completedRef.current && !breakStartedRef.current) {
        startBreak();
      }
    }, MEDIA_FALLBACK_DELAY_MS);

    if (continuationVideoUnavailable || !continuationVideoRef.current) {
      startBreak();
      return;
    }

    setContinuationVisible(true);
    const playResult = continuationVideoRef.current.play();
    if (typeof playResult?.catch === "function") {
      void playResult.catch(() => startBreak());
    }
  }, [continuationVideoUnavailable, startBreak, startRewardScatter]);

  useEffect(() => {
    return () => {
      if (audioFadeInFrameRef.current !== null) {
        window.cancelAnimationFrame(audioFadeInFrameRef.current);
      }
      if (audioFadeOutTimerRef.current !== null) {
        window.clearTimeout(audioFadeOutTimerRef.current);
      }
      if (audioFadeOutFrameRef.current !== null) {
        window.cancelAnimationFrame(audioFadeOutFrameRef.current);
      }
      if (uiExitTimerRef.current !== null) {
        window.clearTimeout(uiExitTimerRef.current);
      }
      if (breakTimerRef.current !== null) {
        window.clearTimeout(breakTimerRef.current);
      }
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
      if (hardCompletionTimeoutRef.current !== null) {
        window.clearTimeout(hardCompletionTimeoutRef.current);
      }
      introAudioRef.current?.pause();
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-hidden bg-transparent"
      data-streak-reward-view
      role="button"
      tabIndex={0}
      aria-label={t("quiz.tapToContinue")}
      onPointerUp={handleScreenActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleScreenActivate();
        }
      }}
    >
      {!introVideoUnavailable ? (
        <video
          ref={introVideoRef}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover",
            continuationVisible || videoExiting
              ? "opacity-0"
              : "animate-streak-reward-video-enter",
          )}
          key={introVideoSource}
          src={introVideoSource}
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={handleIntroVideoPlay}
          onPlaying={handleIntroVideoPlay}
          onError={handleIntroVideoError}
          aria-hidden="true"
        />
      ) : null}
      <audio
        ref={introAudioRef}
        src="/quiz/streak-reward-intro-audio.m4a?v=20261007-1"
        preload="auto"
        aria-hidden="true"
      />
      {!continuationVideoUnavailable ? (
        <video
          ref={continuationVideoRef}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover",
            videoExiting
              ? "animate-streak-reward-video-exit"
              : continuationVisible
                ? "opacity-100"
                : "opacity-0",
          )}
          key={continuationVideoSource}
          src={continuationVideoSource}
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            event.currentTarget.volume = VIDEO_AUDIO_MAX_VOLUME;
          }}
          onPlay={handleContinuationVideoPlay}
          onPlaying={handleContinuationVideoPlay}
          onTimeUpdate={handleContinuationVideoTimeUpdate}
          onEnded={handleContinuationVideoEnded}
          onError={handleContinuationVideoError}
          aria-hidden="true"
        />
      ) : null}
      <div className={cn(
        "pointer-events-none absolute inset-0 animate-streak-reward-ui-enter",
        uiExiting && "animate-streak-reward-ui-exit",
      )}>
        <div
          className={cn(
            "absolute left-1/2 top-5 -translate-x-1/2 sm:top-8",
            rewardStarted ? "animate-streak-reward-hud-enter" : "opacity-0",
          )}
          data-streak-reward-hud
        >
          <MainPointsDisplay
            targetRef={scoreRef}
            pulse={scorePulse}
            className="text-center"
            valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
            value={formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
          />
          <div className="mt-2 flex justify-center">
            <RewardGemHud balances={gemDisplayBalances} pulse={gemPulse} animate superWater={canUseSuperWater(locale)} hudRole="reward" />
          </div>
        </div>
        <div ref={rewardRef} className={cn(
          "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4",
          rewardStarted && "animate-streak-reward-break",
        )} data-quiz-streak-scatter-source>
          <span
            className={cn(
              "animate-streak-reward-text-wiggle whitespace-nowrap text-center text-5xl font-black text-white sm:text-7xl lg:text-8xl",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterText(
              locale,
              t("quiz.streakCount", { count: formatNumber(locale, streak) }),
            )}
          </span>
        </div>
      </div>
      {rewardStarted ? (
        <RewardScatter
          points={{
            amount: points,
            source: rewardRef,
            target: scoreRef,
            placement: { origin: "random", spreadX: 0.56, spreadY: 0.56 },
            zIndex: 71,
          }}
          gems={{
            rewards: gemRewards,
            source: rewardRef,
            targetSelector: '[data-reward-gem-hud-role="reward"] [data-reward-gem-target]',
            placement: { origin: "random", spreadX: 0.55, spreadY: 0.35 },
            zIndex: 112,
          }}
          onPointsArrive={(awardedTotal, arrivalIndex) => {
            setDisplayPoints(totalPoints + awardedTotal);
            setScorePulse(arrivalIndex);
          }}
          onGemArrive={handleGemArrive}
          onGemsComplete={() => {
            finishGemRewardDisplay(gemFinalBalancesRef.current);
            void refreshProfile();
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
