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

const VIDEO_INTERACTION_PAUSE_FRAME = 64;
const VIDEO_FRAME_RATE = 30;
const VIDEO_AUDIO_FADE_IN_DURATION_MS = 500;
const VIDEO_AUDIO_FADE_OUT_DURATION_MS = 2000;
const VIDEO_AUDIO_MAX_VOLUME = 0.75;
const VIDEO_FADE_OUT_DURATION_MS = 250;
const STREAK_REWARD_VIDEO_DURATION_MS = 4064;
const POST_VIDEO_HOLD_DURATION_MS = 1000;
const UI_EXIT_DELAY_AFTER_VIDEO_MS = 700;
const MEDIA_FALLBACK_DELAY_MS = STREAK_REWARD_VIDEO_DURATION_MS + 2000;

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const breakTimerRef = useRef<number | null>(null);
  const audioFadeInFrameRef = useRef<number | null>(null);
  const audioFadeOutTimerRef = useRef<number | null>(null);
  const audioFadeOutFrameRef = useRef<number | null>(null);
  const uiExitTimerRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const hardCompletionTimeoutRef = useRef<number | null>(null);
  const interactionPauseFrameRequestRef = useRef<number | null>(null);
  const rewardStartedRef = useRef(false);
  const breakStartedRef = useRef(false);
  const interactionStartedRef = useRef(false);
  const videoPausedForInteractionRef = useRef(false);
  const audioFadeInStartedRef = useRef(false);
  const audioFadeOutStartedRef = useRef(false);
  const videoPlaybackStartedRef = useRef(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [gemRewards, setGemRewards] = useState<GemRewards>([]);
  const [rewardStarted, setRewardStarted] = useState(false);
  const [videoExiting, setVideoExiting] = useState(false);
  const [videoSource, setVideoSource] = useState("/quiz/streak-reward-background-20260921.mp4?v=20261002-3");
  const [videoUnavailable, setVideoUnavailable] = useState(false);
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (testMode) {
      gemFinalBalancesRef.current = testGemBalances;
      prepareGemRewardDisplay(testGemBalances, testGemRewards);
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

  const startVideoAudioFadeIn = useCallback(() => {
    const video = videoRef.current;
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
    const video = videoRef.current;
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

  const pauseVideoAtInteractionFrame = useCallback(() => {
    const video = videoRef.current;
    if (
      !video ||
      interactionStartedRef.current ||
      videoPausedForInteractionRef.current ||
      interactionPauseFrameRequestRef.current !== null
    ) {
      return;
    }

    if (typeof video.requestVideoFrameCallback === "function") {
      interactionPauseFrameRequestRef.current = video.requestVideoFrameCallback(
        (_now, metadata) => {
          interactionPauseFrameRequestRef.current = null;
          if (interactionStartedRef.current || videoPausedForInteractionRef.current) return;

          if (metadata.presentedFrames >= VIDEO_INTERACTION_PAUSE_FRAME) {
            videoPausedForInteractionRef.current = true;
            video.pause();
            return;
          }

          pauseVideoAtInteractionFrame();
        },
      );
      return;
    }

    // Older webviews do not expose requestVideoFrameCallback. This fallback
    // pauses on the preceding frame boundary rather than seeking backward
    // after an already-visible overshoot.
    if (video.currentTime >= (VIDEO_INTERACTION_PAUSE_FRAME - 1) / VIDEO_FRAME_RATE) {
      videoPausedForInteractionRef.current = true;
      video.pause();
    }
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
    const video = videoRef.current;
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

  const handleVideoPlay = useCallback(() => {
    videoPlaybackStartedRef.current = true;
    startVideoAudioFadeIn();
    pauseVideoAtInteractionFrame();
    if (interactionStartedRef.current) {
      scheduleVideoFade();
    }
  }, [pauseVideoAtInteractionFrame, scheduleVideoFade, startVideoAudioFadeIn]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Covers autoplay starting before the play listener is delivered and keeps
    // the fade timer aligned with the media clock if playback is delayed.
    if (!videoPlaybackStartedRef.current && (!video.paused || video.currentTime > 0)) {
      videoPlaybackStartedRef.current = true;
    }

    if (!interactionStartedRef.current) {
      pauseVideoAtInteractionFrame();
      return;
    }

    scheduleVideoFade();
  }, [pauseVideoAtInteractionFrame, scheduleVideoFade]);

  const handleVideoError = useCallback(() => {
    if (!isNativeMediaFallbackSource(videoSource)) {
      setVideoSource(getNativeMediaFallbackSource(videoSource));
      return;
    }
    setVideoUnavailable(true);
  }, [videoSource]);

  const handleScreenActivate = useCallback(() => {
    if (completedRef.current || interactionStartedRef.current) return;

    const video = videoRef.current;
    if (
      video &&
      videoPlaybackStartedRef.current &&
      !video.paused &&
      !videoPausedForInteractionRef.current
    ) {
      return;
    }

    interactionStartedRef.current = true;
    videoPausedForInteractionRef.current = false;
    if (
      video &&
      interactionPauseFrameRequestRef.current !== null &&
      typeof video.cancelVideoFrameCallback === "function"
    ) {
      video.cancelVideoFrameCallback(interactionPauseFrameRequestRef.current);
      interactionPauseFrameRequestRef.current = null;
    }
    startRewardScatter();

    hardCompletionTimeoutRef.current = window.setTimeout(() => {
      hardCompletionTimeoutRef.current = null;
      if (!completedRef.current && !breakStartedRef.current) {
        startBreak();
      }
    }, MEDIA_FALLBACK_DELAY_MS);

    if (!video || videoUnavailable) return;

    const playResult = video.play();
    if (typeof playResult?.catch === "function") {
      void playResult.catch(() => startBreak());
    }
  }, [startBreak, startRewardScatter, videoUnavailable]);

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
      const video = videoRef.current;
      if (
        video &&
        interactionPauseFrameRequestRef.current !== null &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(interactionPauseFrameRequestRef.current);
      }
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
      {!videoUnavailable ? <video
        ref={videoRef}
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover",
          videoExiting ? "animate-streak-reward-video-exit" : "animate-streak-reward-video-enter",
        )}
        key={videoSource}
        src={videoSource}
        autoPlay
        playsInline
        preload="auto"
        onPlay={handleVideoPlay}
        onPlaying={handleVideoPlay}
        onTimeUpdate={handleVideoTimeUpdate}
        onError={handleVideoError}
        aria-hidden="true"
      /> : null}
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
