"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Flame, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardProgressGemRewardAction } from "@/features/gems/gem-actions";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import { formatNumber } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import {
  createStreakExitMotion,
  stepRigidBody,
  type RigidBodyState,
} from "@/features/quiz/streak-rigid-body";

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

type FlightIcon = {
  id: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

type RewardBreakMotion = {
  number: RigidBodyState;
  icon: RigidBodyState;
};

const BREAK_DELAY_MS = 1000;
const LAST_START_MS = 780;
const EXIT_DURATION_MS = 1000;
const VIDEO_BREAK_BEFORE_END_MS = 1000;
// The fallback matches the bundled reward video. It is only used if the browser
// has not exposed the media duration at the moment playback starts.
const STREAK_REWARD_VIDEO_DURATION_MS = 4064;
const FALLBACK_BREAK_DELAY_MS = STREAK_REWARD_VIDEO_DURATION_MS - VIDEO_BREAK_BEFORE_END_MS;

function motionStyle(motion: RigidBodyState): CSSProperties {
  return {
    transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotation}deg)`,
    transformOrigin: "center",
    willChange: "transform",
  };
}

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
  const { locale } = useLocale();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const rewardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoDurationRef = useRef<number | null>(null);
  const videoPlaybackStartedRef = useRef(false);
  const videoClockIntervalRef = useRef<number | null>(null);
  const videoStartPollRef = useRef<number | null>(null);
  const arrivedIconIdsRef = useRef(new Set<number>());
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const animationFrameRef = useRef<number | null>(null);
  const breakTimerRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const breakStartedRef = useRef(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);
  const [gemRewards, setGemRewards] = useState<GemRewards>([]);
  const [breakMotion, setBreakMotion] = useState<RewardBreakMotion | null>(null);
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

  const startBreak = useCallback(() => {
    if (breakStartedRef.current) return;
    breakStartedRef.current = true;

    if (breakTimerRef.current !== null) {
      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    if (videoClockIntervalRef.current !== null) {
      window.clearInterval(videoClockIntervalRef.current);
      videoClockIntervalRef.current = null;
    }

    const bodies = createStreakExitMotion();
    setBreakMotion({
      number: { ...bodies.number },
      icon: { ...bodies.icon },
    });
    vibrate("streak-break");

    if (rewardRef.current && scoreRef.current) {
      const source = rewardRef.current.getBoundingClientRect();
      const target = scoreRef.current.getBoundingClientRect();
      const iconCount = getScoreFlightIconCount(points);
      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      const icons = Array.from({ length: iconCount }, (_, index) => {
        const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
        const startX = source.left + source.width * (0.22 + Math.random() * 0.56);
        const startY = source.top + source.height * (0.22 + Math.random() * 0.56);
        return {
          id: index, startX, startY, targetX, targetY,
          scatterX: (Math.random() - 0.5) * 150,
          scatterY: -35 - Math.random() * 100,
          delay: Math.round(ratio * LAST_START_MS),
        };
      });

      setFlightIcons(icons);
    }

    let elapsed = 0;
    let lastTimestamp: number | null = null;
    const tick = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.032);
      lastTimestamp = timestamp;
      elapsed += delta * 1000;

      stepRigidBody(bodies.number, delta);
      stepRigidBody(bodies.icon, delta);
      setBreakMotion({
        number: { ...bodies.number },
        icon: { ...bodies.icon },
      });

      if (elapsed < EXIT_DURATION_MS) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    completionTimeoutRef.current = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    }, EXIT_DURATION_MS);
  }, [points]);

  const scheduleBreak = useCallback((delayMs: number) => {
    if (breakStartedRef.current || breakTimerRef.current !== null) return;
    const normalizedDelay = Math.max(0, delayMs);
    breakTimerRef.current = window.setTimeout(startBreak, normalizedDelay);
  }, [startBreak]);

  useEffect(() => {
    // Never let a missed media event leave the reward overlay on its last
    // frame. The bundled video has a fixed duration, so this watchdog is a
    // deterministic fallback until the media clock can refine it.
    scheduleBreak(FALLBACK_BREAK_DELAY_MS);
  }, [scheduleBreak]);

  const scheduleBreakFromVideo = useCallback(() => {
    const video = videoRef.current;
    const duration = video && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : (videoDurationRef.current ?? STREAK_REWARD_VIDEO_DURATION_MS / 1000);
    if (!video || !videoPlaybackStartedRef.current) return;

    const remainingMs = Math.max(0, (duration - video.currentTime) * 1000);
    scheduleBreak(Math.max(0, remainingMs - VIDEO_BREAK_BEFORE_END_MS));
  }, [scheduleBreak]);

  const checkVideoClock = useCallback(() => {
    const video = videoRef.current;
    const duration = video && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : (videoDurationRef.current ?? STREAK_REWARD_VIDEO_DURATION_MS / 1000);
    if (!video || !videoPlaybackStartedRef.current || breakStartedRef.current) return;

    const remainingMs = Math.max(0, (duration - video.currentTime) * 1000);
    if (remainingMs <= VIDEO_BREAK_BEFORE_END_MS) {
      startBreak();
    }
  }, [startBreak]);

  const startVideoClock = useCallback(() => {
    checkVideoClock();
    if (videoClockIntervalRef.current !== null) return;
    // Media time is the source of truth. This catches the exact one-second
    // threshold even when the browser emits `timeupdate` infrequently.
    videoClockIntervalRef.current = window.setInterval(checkVideoClock, 16);
  }, [checkVideoClock]);

  const rescheduleBreakFromVideo = useCallback(() => {
    if (breakStartedRef.current) return;
    if (breakTimerRef.current !== null) {
      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    scheduleBreakFromVideo();
  }, [scheduleBreakFromVideo]);

  const handleVideoMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    videoDurationRef.current = video.duration;

    // Metadata is available before autoplay events are guaranteed to reach
    // React. Establish the absolute fallback from the media duration here so
    // a missed `play`/`timeupdate` event can never leave the screen frozen.
    const remainingMs = Math.max(0, (video.duration - video.currentTime) * 1000);
    scheduleBreak(Math.max(0, remainingMs - VIDEO_BREAK_BEFORE_END_MS));

    if (!video.paused || video.currentTime > 0) {
      videoPlaybackStartedRef.current = true;
      rescheduleBreakFromVideo();
      startVideoClock();
    }
  }, [rescheduleBreakFromVideo, scheduleBreak, startVideoClock]);

  const handleVideoPlay = useCallback(() => {
    videoPlaybackStartedRef.current = true;
    rescheduleBreakFromVideo();
    startVideoClock();
  }, [rescheduleBreakFromVideo, startVideoClock]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const duration = video && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : (videoDurationRef.current ?? STREAK_REWARD_VIDEO_DURATION_MS / 1000);
    if (!video) return;

    // Autoplay can begin before React attaches the `play` listener during
    // hydration. A real timeupdate is enough proof that the media clock is
    // running, so do not wait for `onPlay` in that case.
    if (!videoPlaybackStartedRef.current && (!video.paused || video.currentTime > 0)) {
      videoPlaybackStartedRef.current = true;
      rescheduleBreakFromVideo();
      startVideoClock();
    }
    if (!duration || !videoPlaybackStartedRef.current) return;

    const remainingMs = Math.max(0, (duration - video.currentTime) * 1000);
    if (remainingMs <= VIDEO_BREAK_BEFORE_END_MS) {
      startBreak();
    }
  }, [rescheduleBreakFromVideo, startBreak, startVideoClock]);

  useEffect(() => {
    // This poll covers the same hydration race even when the first
    // `timeupdate` event was emitted before React finished binding handlers.
    const poll = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || breakStartedRef.current) return;
      if (video.paused || video.currentTime <= 0.02) return;

      videoPlaybackStartedRef.current = true;
      rescheduleBreakFromVideo();
      startVideoClock();
      window.clearInterval(poll);
      videoStartPollRef.current = null;
    }, 16);
    videoStartPollRef.current = poll;

    return () => {
      window.clearInterval(poll);
      if (videoStartPollRef.current === poll) videoStartPollRef.current = null;
    };
  }, [rescheduleBreakFromVideo, startVideoClock]);

  useEffect(() => {
    return () => {
      if (breakTimerRef.current !== null) {
        window.clearTimeout(breakTimerRef.current);
      }
      if (videoClockIntervalRef.current !== null) {
        window.clearInterval(videoClockIntervalRef.current);
      }
      if (videoStartPollRef.current !== null) {
        window.clearInterval(videoStartPollRef.current);
      }
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  function handleFlightEnd(icon: FlightIcon) {
    if (arrivedIconIdsRef.current.has(icon.id)) return;
    arrivedIconIdsRef.current.add(icon.id);

    const arrivalIndex = arrivedIconIdsRef.current.size;
    setDisplayPoints(
      totalPoints + getScoreFlightAwardAtArrival(points, flightIcons.length, arrivalIndex),
    );
    setScorePulse(arrivalIndex);
    playSoundEffect("points");
    vibrate("tap");

    // Flight completion only updates the score and feedback while the video-aligned exit runs.
  }

  return typeof document === "undefined" ? null : createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-transparent" data-streak-reward-view aria-hidden="true">
      <video
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover",
          breakMotion ? "animate-streak-reward-video-exit" : "animate-streak-reward-video-enter",
        )}
        src="/quiz/streak-reward-background-20260921.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={handleVideoMetadata}
        onCanPlay={handleVideoPlay}
        onPlay={handleVideoPlay}
        onPlaying={handleVideoPlay}
        onTimeUpdate={handleVideoTimeUpdate}
        onError={() => scheduleBreak(BREAK_DELAY_MS)}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 animate-streak-reward-ui-enter">
        <div className="absolute left-1/2 top-5 -translate-x-1/2 sm:top-8">
          <div className="relative flex items-center justify-center gap-2 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-center text-white shadow-lg">
            <Star className="size-5 fill-current" aria-hidden="true" />
            <span ref={scoreRef} key={scorePulse} className={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water", scorePulse > 0 && "animate-score-bobble")}>
              {formatSuperWaterText(locale, formatNumber(locale, displayPoints))}
            </span>
          </div>
          <RewardGemHud className="mt-2" balances={gemDisplayBalances} pulse={gemPulse} animate superWater={canUseSuperWater(locale)} />
        </div>
        <div ref={rewardRef} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
          <span
            className="text-7xl font-black text-white sm:text-8xl lg:text-9xl"
            style={breakMotion ? motionStyle(breakMotion.number) : undefined}
          >
            {streak}
          </span>
          <Flame
            className="size-16 animate-streak-fire text-red-500 sm:size-20"
            fill="currentColor"
            style={breakMotion ? motionStyle(breakMotion.icon) : undefined}
          />
        </div>
      </div>
      {flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[71] animate-quiz-score-icon-flight" style={{
          "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`,
          "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
          "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`,
          animationDelay: `${icon.delay}ms`,
        } as CSSProperties} onAnimationEnd={() => handleFlightEnd(icon)}><ScoreIcon size={32} /></span>
      ))}
      {breakMotion ? (
        <GemRewardFlight
          key={gemRewards.map((item) => `${item.type}-${item.amount}`).join("|") || "no-gem-reward"}
          rewards={gemRewards}
          sourceRef={rewardRef}
          startDelayMs={0}
          onGemArrive={handleGemArrive}
          onComplete={() => {
            finishGemRewardDisplay(gemFinalBalancesRef.current);
            void refreshProfile();
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
