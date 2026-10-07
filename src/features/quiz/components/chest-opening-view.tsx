"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type SyntheticEvent } from "react";
import Image from "next/image";
import { ScoreIcon } from "@/components/score-icon";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import {
  CHEST_TIER_OPENING_AUDIO,
  CHEST_TIER_OPENING_VIDEOS,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import { GEM_ASSETS, type ChestRewardOutcome, type GemBalances, type GemType } from "@/features/gems/gem-types";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { getNativeMediaFallbackSource, isNativeMediaFallbackSource } from "@/lib/native-media-fallback";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  totalPoints: number;
  onComplete: () => void;
  onRewardReady?: () => Promise<ChestRewardOutcome | null>;
  reward?: ChestRewardOutcome | null;
  enterWithCss?: boolean;
  autoPlay?: boolean;
  onVideoReady?: (video: HTMLVideoElement | null) => void;
}

type ChestPhase = "playing" | "revealed" | "disappearing";
type PointsPhase = "hidden" | "shown" | "flying" | "added";
const REWARD_REVEAL_AT_SECONDS = 3;
const REWARD_HOLD_BEFORE_FLIGHT_MS = 800;
const VIDEO_LAST_FRAME_HOLD_MS = 2000;
const VIDEO_AUDIO_FADE_DURATION_MS = 800;
const DISAPPEAR_MS = 500;
const DOUBLE_TAP_WINDOW_MS = 280;

const GEM_REWARD_BOX_CLASSES: Record<GemType, string> = {
  blue: "border-sky-300/60 bg-sky-500/95",
  green: "border-emerald-300/60 bg-emerald-500/95",
  purple: "border-violet-300/60 bg-violet-500/95",
};

const GEM_REWARD_FOOTER_CLASSES: Record<GemType, string> = {
  blue: "bg-sky-700/90",
  green: "bg-emerald-700/90",
  purple: "bg-violet-700/90",
};

export function ChestOpeningView({
  tier,
  totalPoints,
  onComplete,
  onRewardReady,
  reward,
  enterWithCss = true,
  autoPlay = true,
  onVideoReady,
}: ChestOpeningViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const usesSuperWater = canUseSuperWater(locale);
  const [stableTotalPoints] = useState(totalPoints);
  const [phase, setPhase] = useState<ChestPhase>("playing");
  const [pointsPhase, setPointsPhase] = useState<PointsPhase>("hidden");
  const [displayPoints, setDisplayPoints] = useState(stableTotalPoints);
  const [rewardOutcome, setRewardOutcome] = useState<ChestRewardOutcome | null>(reward ?? null);
  const [videoSource, setVideoSource] = useState(CHEST_TIER_OPENING_VIDEOS[tier.tier]);
  const [audioSource, setAudioSource] = useState(CHEST_TIER_OPENING_AUDIO[tier.tier]);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [rewardResolved, setRewardResolved] = useState(!onRewardReady || Boolean(reward));
  const [rewardRevealReady, setRewardRevealReady] = useState(false);
  const [pointsDisplayPulse, setPointsDisplayPulse] = useState(0);
  const [pointsSourcePulse, setPointsSourcePulse] = useState(0);
  const [gemSourcePulse, setGemSourcePulse] = useState<Record<GemType, number>>({ blue: 0, green: 0, purple: 0 });
  const gemFinalBalancesRef = useRef<GemBalances | null>(null);
  const {
    balances: gemDisplayBalances,
    pulse: gemPulse,
    prepare: prepareGemRewardDisplay,
    handleGemArrive,
    finish: finishGemRewardDisplay,
  } = useGemRewardDisplay();
  const hasCompleted = useRef(false);
  const rewardRevealTriggeredRef = useRef(false);
  const hasShownRewardsRef = useRef(false);
  const hasTriggeredOpenHapticRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStartedRef = useRef(false);
  const videoCompletionModeRef = useRef<"playing" | "ended" | "skipped">("playing");
  const lastTapAtRef = useRef(0);
  const rewardPromiseRef = useRef<Promise<ChestRewardOutcome | null> | null>(null);
  const totalPointsRef = useRef<HTMLSpanElement | null>(null);
  const rewardPointsRef = useRef<HTMLDivElement | null>(null);
  const blueGemRewardRef = useRef<HTMLDivElement | null>(null);
  const greenGemRewardRef = useRef<HTMLDivElement | null>(null);
  const purpleGemRewardRef = useRef<HTMLDivElement | null>(null);
  const pointsTimeoutRef = useRef<number | null>(null);
  const videoEndCloseTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const videoRevealTimeoutRef = useRef<number | null>(null);
  const pointsScatterCompleteRef = useRef(false);
  const gemsScatterCompleteRef = useRef(false);
  const scatterCompletionTriggeredRef = useRef(false);

  const attachVideoRef = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    onVideoReady?.(video);
  }, [onVideoReady]);

  const rewardGemSourceRefs = useMemo<Partial<Record<GemType, RefObject<HTMLElement | null>>>>(
    () => ({ blue: blueGemRewardRef, green: greenGemRewardRef, purple: purpleGemRewardRef }),
    [],
  );

  const formatRewardText = useCallback(
    (text: string) => (usesSuperWater ? formatSuperWaterText(locale, text) : text),
    [locale, usesSuperWater],
  );

  const revealAtVideoTimestamp = useCallback(() => {
    if (rewardRevealTriggeredRef.current) return;
    rewardRevealTriggeredRef.current = true;
    if (videoRevealTimeoutRef.current !== null) {
      window.clearTimeout(videoRevealTimeoutRef.current);
      videoRevealTimeoutRef.current = null;
    }
    setRewardRevealReady(true);
  }, []);

  const handleVideoPlay = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    video.muted = true;
    video.volume = 0;
    const audio = audioRef.current;
    if (audio) {
      audioStartedRef.current = true;
      try {
        audio.currentTime = video.currentTime;
      } catch {
        // Seeking the separate track is best effort on older WebViews.
      }
      const playResult = audio.play?.();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch(() => undefined);
      }
    }
    if (!hasTriggeredOpenHapticRef.current) {
      hasTriggeredOpenHapticRef.current = true;
      try {
        vibrate("chest-open");
      } catch {
        // Optional audio and haptics must not block the reward flow.
      }
    }

    if (rewardRevealTriggeredRef.current) return;
    const remainingMs = Math.max(
      0,
      (REWARD_REVEAL_AT_SECONDS - event.currentTarget.currentTime) * 1000,
    );
    videoRevealTimeoutRef.current = window.setTimeout(revealAtVideoTimestamp, remainingMs);
  }, [revealAtVideoTimestamp]);

  const handleVideoTimeUpdate = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const audio = audioRef.current;
    if (audio && audioStartedRef.current) {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.16) {
        try {
          audio.currentTime = video.currentTime;
        } catch {
          // Keep the video usable if a WebView rejects a seek during startup.
        }
      }
    }
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const fadeStart = video.duration - VIDEO_AUDIO_FADE_DURATION_MS / 1000;
      if (video.currentTime >= fadeStart) {
        const fadeProgress = Math.max(0, Math.min(1, (video.duration - video.currentTime) / (VIDEO_AUDIO_FADE_DURATION_MS / 1000)));
        if (audio) audio.volume = fadeProgress;
      }
    }

    if (video.currentTime >= REWARD_REVEAL_AT_SECONDS) {
      revealAtVideoTimestamp();
    }
  }, [revealAtVideoTimestamp]);

  const handleCollect = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    setPhase("disappearing");
    completeTimeoutRef.current = window.setTimeout(onComplete, DISAPPEAR_MS);
  }, [onComplete]);

  const tryCompleteAfterSkippedScatter = useCallback(() => {
    if (videoCompletionModeRef.current !== "skipped") return;
    if (scatterCompletionTriggeredRef.current) return;

    const currentRewardPoints = rewardOutcome?.points ?? tier.points;
    const currentRewardList = rewardOutcome?.rewards ?? [];
    const pointsFinished = currentRewardPoints <= 0 || pointsScatterCompleteRef.current;
    const gemsFinished = currentRewardList.length === 0 || gemsScatterCompleteRef.current;
    if (!pointsFinished || !gemsFinished) return;

    scatterCompletionTriggeredRef.current = true;
    handleCollect();
  }, [handleCollect, rewardOutcome, tier.points]);

  const skipVideoToLastFrame = useCallback(() => {
    if (phase !== "playing" || videoCompletionModeRef.current !== "playing") return;

    videoCompletionModeRef.current = "skipped";
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.volume = 0;
      audioRef.current?.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        try {
          video.currentTime = video.duration;
        } catch {
          // Some browsers reject seeking while the media element is still loading.
        }
      }
    }
    revealAtVideoTimestamp();
  }, [phase, revealAtVideoTimestamp]);

  const handleSurfacePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;

    const now = Date.now();
    if (now - lastTapAtRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastTapAtRef.current = 0;
      skipVideoToLastFrame();
      return;
    }
    lastTapAtRef.current = now;
  }, [skipVideoToLastFrame]);

  const handleVideoEnded = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    event.currentTarget.muted = true;
    event.currentTarget.volume = 0;
    audioRef.current?.pause();
    if (videoCompletionModeRef.current === "skipped") {
      event.currentTarget.pause();
      revealAtVideoTimestamp();
      return;
    }

    videoCompletionModeRef.current = "ended";
    revealAtVideoTimestamp();
    if (videoEndCloseTimeoutRef.current !== null) {
      window.clearTimeout(videoEndCloseTimeoutRef.current);
    }
    videoEndCloseTimeoutRef.current = window.setTimeout(handleCollect, VIDEO_LAST_FRAME_HOLD_MS);
  }, [handleCollect, revealAtVideoTimestamp]);

  const handleVideoError = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    if (!isNativeMediaFallbackSource(videoSource)) {
      setVideoSource(getNativeMediaFallbackSource(videoSource));
      return;
    }

    setVideoUnavailable(true);
    handleVideoEnded(event);
  }, [handleVideoEnded, videoSource]);

  useEffect(() => {
    // The media element must be reset synchronously when a different chest tier is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoSource(CHEST_TIER_OPENING_VIDEOS[tier.tier]);
    setAudioSource(CHEST_TIER_OPENING_AUDIO[tier.tier]);
    setVideoUnavailable(false);
    videoCompletionModeRef.current = "playing";
    lastTapAtRef.current = 0;
    audioStartedRef.current = false;
  }, [tier.tier]);

  useEffect(() => {
    if (reward) {
      rewardPromiseRef.current = Promise.resolve(reward);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRewardOutcome(reward);
      setRewardResolved(true);
      return;
    }

    if (!onRewardReady) {
      setRewardResolved(true);
      return;
    }

    rewardPromiseRef.current ??= onRewardReady().catch(() => null);
    let active = true;
    void rewardPromiseRef.current.then((outcome) => {
      if (!active) return;
      setRewardOutcome(outcome);
      setRewardResolved(true);
    });

    return () => {
      active = false;
    };
  }, [onRewardReady, reward]);

  useEffect(() => {
    if (!rewardOutcome?.balances) return;
    gemFinalBalancesRef.current = rewardOutcome.balances;
    prepareGemRewardDisplay(rewardOutcome.balances, rewardOutcome.rewards);
  }, [prepareGemRewardDisplay, rewardOutcome]);

  useEffect(() => {
    if (!rewardRevealReady || !rewardResolved || hasShownRewardsRef.current) return;
    hasShownRewardsRef.current = true;
    setPhase("revealed");
    setPointsPhase("shown");
    pointsTimeoutRef.current = window.setTimeout(() => {
      setPointsPhase("flying");
    }, REWARD_HOLD_BEFORE_FLIGHT_MS);

    return () => {
      if (pointsTimeoutRef.current !== null) window.clearTimeout(pointsTimeoutRef.current);
    };
  }, [rewardResolved, rewardRevealReady]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (pointsTimeoutRef.current !== null) window.clearTimeout(pointsTimeoutRef.current);
      if (videoEndCloseTimeoutRef.current !== null) window.clearTimeout(videoEndCloseTimeoutRef.current);
      if (completeTimeoutRef.current !== null) window.clearTimeout(completeTimeoutRef.current);
      if (videoRevealTimeoutRef.current !== null) window.clearTimeout(videoRevealTimeoutRef.current);
      audio?.pause();
    };
  }, []);

  const rewardPoints = rewardOutcome?.points ?? tier.points;
  const shouldRenderRewardSources = phase === "revealed" || phase === "disappearing";
  const rewardList = rewardOutcome?.rewards ?? [];

  const bumpGemSourcePulse = useCallback((type: GemType) => {
    setGemSourcePulse((current) => ({ ...current, [type]: current[type] + 1 }));
  }, []);

  return (
    <div
      data-chest-opening-view
      data-chest-opening-layout
      onPointerUp={handleSurfacePointerUp}
      onDoubleClick={skipVideoToLastFrame}
      className={cn(
        "relative flex h-full min-h-full w-full touch-manipulation items-center justify-center overflow-hidden bg-[#121212] px-4 py-6 text-center sm:px-6 sm:py-8",
        phase === "disappearing"
          ? "animate-chest-screen-close"
          : enterWithCss
            ? "animate-screen-pop"
            : "opacity-100",
      )}
    >
      {!videoUnavailable ? <video
        key={videoSource}
        ref={attachVideoRef}
        autoPlay={autoPlay}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        data-chest-opening-video
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
        onEnded={handleVideoEnded}
        onPlay={handleVideoPlay}
        onTimeUpdate={handleVideoTimeUpdate}
        onError={handleVideoError}
      >
        <source src={videoSource} type="video/mp4" />
      </video> : null}
      <audio
        ref={audioRef}
        src={audioSource}
        preload="auto"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full w-full max-w-5xl flex-1 flex-col">
        <div className={cn(
          "fixed inset-x-0 top-10 z-30 flex flex-col items-center gap-2 transition-[opacity,transform] duration-300 ease-out sm:top-12",
          !shouldRenderRewardSources && "translate-y-2 opacity-0",
        )}>
          <MainPointsDisplay
            data-chest-total-points-shell
            targetRef={totalPointsRef}
            pulse={pointsDisplayPulse}
            className="sm:px-5"
            icon={<ScoreIcon size={24} className="size-6 brightness-0 invert" />}
            valueDataAttributes={{ "data-chest-total-points": "" }}
            valueClassName={cn("text-lg font-bold sm:text-xl", usesSuperWater && "font-super-water")}
            value={formatRewardText(formatNumber(locale, displayPoints))}
          />
          <RewardGemHud
            className="transition-[opacity,transform] duration-300 ease-out"
            balances={gemDisplayBalances}
            pulse={gemPulse}
            superWater={usesSuperWater}
            desktopVisible
            hudRole="reward"
          />
        </div>

        {shouldRenderRewardSources ? (
          <div
            data-chest-reward-sources
            className={cn(
              "pointer-events-none fixed inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 px-3 sm:bottom-8 sm:gap-4",
              phase === "disappearing" && "animate-chest-screen-close",
            )}
          >
            <div
              data-chest-reward-heading
              className={cn(
                "flex items-center justify-center gap-3 text-2xl font-bold leading-none text-white drop-shadow-sm sm:text-3xl",
                usesSuperWater && "font-super-water",
              )}
            >
              <span aria-hidden="true" className={cn(
                "animate-chest-reward-heading-line-left inline-block h-1 w-12 rounded-full bg-white/90 sm:w-16",
              )} />
              <span className="animate-chest-reward-heading-text">{formatSuperWaterUppercaseText(locale, t("chest.rewardsHeader"))}</span>
              <span aria-hidden="true" className={cn(
                "animate-chest-reward-heading-line-right inline-block h-1 w-12 rounded-full bg-white/90 sm:w-16",
              )} />
            </div>

            <div
              data-chest-reward-boxes
              className="flex w-full max-w-4xl items-stretch justify-center gap-2 sm:gap-3"
            >
              <div
                ref={rewardPointsRef}
                key={`points-${pointsSourcePulse}`}
                data-chest-reward-points
                className={cn(
                  "flex aspect-[0.7] w-[clamp(6.5rem,21vw,9rem)] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border-[3px] border-amber-200/90 bg-amber-400 text-white shadow-lg",
                  pointsSourcePulse === 0 && "animate-chest-reward-box-enter",
                  pointsSourcePulse > 0 && "animate-bonus-reward-pulse",
                )}
                style={{ animationDelay: "0ms" }}
              >
                <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-3">
                  <ScoreIcon size={88} className="size-[clamp(3.5rem,12vw,5.5rem)]" />
                </div>
                <div className={cn(
                  "flex min-h-[3.25rem] items-center justify-center gap-1.5 bg-amber-600/90 px-2 py-2 text-[clamp(1.35rem,5vw,2rem)] font-bold leading-none sm:min-h-[4rem] sm:gap-2",
                  usesSuperWater && "font-super-water",
                )}>
                  <span>{formatRewardText(formatNumber(locale, rewardPoints))}</span>
                  <ScoreIcon size={34} className="size-[clamp(1.5rem,5vw,2.15rem)]" />
                </div>
              </div>

              {rewardList.map((item, rewardIndex) => {
                const entryDelay = `${(rewardIndex + 1) * 130}ms`;
                const ref = item.type === "blue"
                  ? blueGemRewardRef
                  : item.type === "green"
                    ? greenGemRewardRef
                    : purpleGemRewardRef;
                return (
                  <div
                    ref={ref}
                    key={`${item.type}-${gemSourcePulse[item.type]}`}
                    data-chest-reward-gem={item.type}
                    aria-label={`${item.amount}`}
                    className={cn(
                      "flex aspect-[0.7] w-[clamp(6.5rem,21vw,9rem)] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border-[3px] text-white shadow-lg",
                      GEM_REWARD_BOX_CLASSES[item.type],
                      gemSourcePulse[item.type] === 0 && "animate-chest-reward-box-enter",
                      gemSourcePulse[item.type] > 0 && "animate-bonus-reward-pulse",
                    )}
                    style={gemSourcePulse[item.type] === 0 ? { animationDelay: entryDelay } : undefined}
                  >
                    <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-3">
                      <Image src={GEM_ASSETS[item.type]} alt="" width={88} height={88} className="size-[clamp(3.5rem,12vw,5.5rem)] object-contain" />
                    </div>
                    <div className={cn(
                      "flex min-h-[3.25rem] items-center justify-center gap-1.5 px-2 py-2 text-[clamp(1.35rem,5vw,2rem)] font-bold leading-none sm:min-h-[4rem] sm:gap-2",
                      GEM_REWARD_FOOTER_CLASSES[item.type],
                      usesSuperWater && "font-super-water",
                    )}>
                      <span>{formatRewardText(String(item.amount))}</span>
                      <Image src={GEM_ASSETS[item.type]} alt="" width={34} height={34} className="size-[clamp(1.5rem,5vw,2.15rem)] object-contain" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <RewardScatter
        points={pointsPhase === "flying" ? {
          amount: rewardPoints,
          source: rewardPointsRef,
          target: totalPointsRef,
          placement: { origin: "random", spreadX: 0.55, spreadY: 0.35 },
          zIndex: 111,
        } : null}
        gems={{
          rewards: pointsPhase === "flying" ? rewardList : [],
          source: blueGemRewardRef,
          sources: rewardGemSourceRefs,
          targetSelector: '[data-reward-gem-hud-role="reward"] [data-reward-gem-target]',
          placement: { origin: "random", spreadX: 0.55, spreadY: 0.35 },
          zIndex: 112,
        }}
        onPointsLaunch={() => setPointsSourcePulse((current) => current + 1)}
        onPointsArrive={(awardedTotal, arrivalIndex) => {
          setDisplayPoints(stableTotalPoints + awardedTotal);
          setPointsDisplayPulse(arrivalIndex);
        }}
        onPointsComplete={() => {
          pointsScatterCompleteRef.current = true;
          setPointsPhase("added");
          tryCompleteAfterSkippedScatter();
        }}
        onGemLaunch={bumpGemSourcePulse}
        onGemArrive={handleGemArrive}
        onGemsComplete={() => {
          gemsScatterCompleteRef.current = true;
          finishGemRewardDisplay(gemFinalBalancesRef.current);
          tryCompleteAfterSkippedScatter();
        }}
      />
    </div>
  );
}
