"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Image from "next/image";
import { ScoreIcon } from "@/components/score-icon";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import {
  CHEST_TIER_OPENING_AUDIO,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import {
  CHEST_OPENING_ATLAS_COLUMNS,
  CHEST_OPENING_ATLAS_COUNT,
  CHEST_OPENING_DURATION_SECONDS,
  CHEST_OPENING_FRAME_COUNT,
  CHEST_OPENING_FRAME_HEIGHT,
  CHEST_OPENING_FRAME_RATE,
  CHEST_OPENING_FRAME_WIDTH,
  CHEST_OPENING_FRAMES_PER_ATLAS,
  getChestOpeningAtlasSource,
  loadChestOpeningAtlasImage,
  preloadChestOpeningFrames,
} from "@/features/quiz/chest-opening-frames";
import { GEM_ASSETS, type ChestRewardOutcome, type GemBalances, type GemType } from "@/features/gems/gem-types";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  totalPoints: number;
  onComplete: () => void;
  onRewardReady?: () => Promise<ChestRewardOutcome | null>;
  reward?: ChestRewardOutcome | null;
  enterWithCss?: boolean;
  autoPlay?: boolean;
  onOpeningReady?: (start: (() => void) | null) => void;
}

type ChestPhase = "playing" | "revealed" | "disappearing";
type PointsPhase = "hidden" | "shown" | "flying" | "added";
const REWARD_REVEAL_AT_SECONDS = 3;
const REWARD_HOLD_BEFORE_FLIGHT_MS = 800;
const ANIMATION_LAST_FRAME_HOLD_MS = 2000;
const ANIMATION_AUDIO_FADE_DURATION_MS = 800;
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
  onOpeningReady,
}: ChestOpeningViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const usesSuperWater = canUseSuperWater(locale);
  const [stableTotalPoints] = useState(totalPoints);
  const [phase, setPhase] = useState<ChestPhase>("playing");
  const [pointsPhase, setPointsPhase] = useState<PointsPhase>("hidden");
  const [displayPoints, setDisplayPoints] = useState(stableTotalPoints);
  const [rewardOutcome, setRewardOutcome] = useState<ChestRewardOutcome | null>(reward ?? null);
  const audioSource = CHEST_TIER_OPENING_AUDIO[tier.tier];
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStartedRef = useRef(false);
  const animationCompletionModeRef = useRef<"playing" | "ended" | "skipped">("playing");
  const animationStartedRef = useRef(false);
  const animationStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastRequestedFrameRef = useRef<number | null>(null);
  const lastDrawnFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<(frameIndex: number) => void>(() => undefined);
  const loadedAtlasesRef = useRef(new Map<number, { drawable: CanvasImageSource; release: () => void }>());
  const atlasPromisesRef = useRef(new Map<number, Promise<{ drawable: CanvasImageSource; release: () => void } | null>>());
  const atlasGenerationRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const rewardPromiseRef = useRef<Promise<ChestRewardOutcome | null> | null>(null);
  const totalPointsRef = useRef<HTMLSpanElement | null>(null);
  const rewardPointsRef = useRef<HTMLDivElement | null>(null);
  const blueGemRewardRef = useRef<HTMLDivElement | null>(null);
  const greenGemRewardRef = useRef<HTMLDivElement | null>(null);
  const purpleGemRewardRef = useRef<HTMLDivElement | null>(null);
  const pointsTimeoutRef = useRef<number | null>(null);
  const animationEndCloseTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const pointsScatterCompleteRef = useRef(false);
  const gemsScatterCompleteRef = useRef(false);
  const scatterCompletionTriggeredRef = useRef(false);

  const rewardGemSourceRefs = useMemo<Partial<Record<GemType, RefObject<HTMLElement | null>>>>(
    () => ({ blue: blueGemRewardRef, green: greenGemRewardRef, purple: purpleGemRewardRef }),
    [],
  );

  const formatRewardText = useCallback(
    (text: string) => (usesSuperWater ? formatSuperWaterText(locale, text) : text),
    [locale, usesSuperWater],
  );

  const revealAtAnimationTimestamp = useCallback(() => {
    if (rewardRevealTriggeredRef.current) return;
    rewardRevealTriggeredRef.current = true;
    setRewardRevealReady(true);
  }, []);

  const handleCollect = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    setPhase("disappearing");
    completeTimeoutRef.current = window.setTimeout(onComplete, DISAPPEAR_MS);
  }, [onComplete]);

  const tryCompleteAfterSkippedScatter = useCallback(() => {
    if (animationCompletionModeRef.current !== "skipped") return;
    if (scatterCompletionTriggeredRef.current) return;

    const currentRewardPoints = rewardOutcome?.points ?? tier.points;
    const currentRewardList = rewardOutcome?.rewards ?? [];
    const pointsFinished = currentRewardPoints <= 0 || pointsScatterCompleteRef.current;
    const gemsFinished = currentRewardList.length === 0 || gemsScatterCompleteRef.current;
    if (!pointsFinished || !gemsFinished) return;

    scatterCompletionTriggeredRef.current = true;
    handleCollect();
  }, [handleCollect, rewardOutcome, tier.points]);

  const ensureAtlasImage = useCallback((atlasIndex: number) => {
    const loaded = loadedAtlasesRef.current.get(atlasIndex);
    if (loaded) return Promise.resolve(loaded);

    const pending = atlasPromisesRef.current.get(atlasIndex);
    if (pending) return pending;

    const generation = atlasGenerationRef.current;
    const request = (async () => {
      try {
        const image = await loadChestOpeningAtlasImage(getChestOpeningAtlasSource(tier.tier, atlasIndex));

        const loadedAtlas = { drawable: image, release: () => { image.src = "data:,"; } };

        if (generation !== atlasGenerationRef.current) {
          loadedAtlas.release();
          return null;
        }

        const requestedFrame = lastRequestedFrameRef.current;
        const requestedAtlasIndex = requestedFrame === null
          ? 0
          : Math.floor(requestedFrame / CHEST_OPENING_FRAMES_PER_ATLAS);
        if (atlasIndex < requestedAtlasIndex || atlasIndex > requestedAtlasIndex + 1) {
          loadedAtlas.release();
          return null;
        }

        loadedAtlasesRef.current.set(atlasIndex, loadedAtlas);
        if (requestedFrame !== null && Math.floor(requestedFrame / CHEST_OPENING_FRAMES_PER_ATLAS) === atlasIndex) {
          drawFrameRef.current(requestedFrame);
        }
        return loadedAtlas;
      } catch {
        return null;
      }
    })();

    atlasPromisesRef.current.set(atlasIndex, request);
    return request;
  }, [tier.tier]);

  const drawFrame = useCallback((requestedFrame: number) => {
    const frameIndex = Math.max(0, Math.min(CHEST_OPENING_FRAME_COUNT - 1, requestedFrame));
    lastRequestedFrameRef.current = frameIndex;
    const atlasIndex = Math.floor(frameIndex / CHEST_OPENING_FRAMES_PER_ATLAS);
    const atlas = loadedAtlasesRef.current.get(atlasIndex);

    if (!atlas && !atlasPromisesRef.current.has(atlasIndex)) {
      void ensureAtlasImage(atlasIndex);
    }
    if (
      atlasIndex + 1 < CHEST_OPENING_ATLAS_COUNT &&
      !loadedAtlasesRef.current.has(atlasIndex + 1) &&
      !atlasPromisesRef.current.has(atlasIndex + 1)
    ) {
      void ensureAtlasImage(atlasIndex + 1);
    }

    if (!atlas) return;

    for (const [loadedIndex, loadedAtlas] of loadedAtlasesRef.current) {
      if (loadedIndex === atlasIndex || loadedIndex === atlasIndex + 1) continue;
      loadedAtlas.release();
      loadedAtlasesRef.current.delete(loadedIndex);
      atlasPromisesRef.current.delete(loadedIndex);
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false, desynchronized: true });
    if (!canvas || !context) return;

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (
      lastDrawnFrameRef.current === frameIndex &&
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight
    ) {
      return;
    }
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const scale = Math.max(width / CHEST_OPENING_FRAME_WIDTH, height / CHEST_OPENING_FRAME_HEIGHT);
    const drawWidth = CHEST_OPENING_FRAME_WIDTH * scale;
    const drawHeight = CHEST_OPENING_FRAME_HEIGHT * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    const atlasFrame = frameIndex % CHEST_OPENING_FRAMES_PER_ATLAS;
    const sourceX = (atlasFrame % CHEST_OPENING_ATLAS_COLUMNS) * CHEST_OPENING_FRAME_WIDTH;
    const sourceY = Math.floor(atlasFrame / CHEST_OPENING_ATLAS_COLUMNS) * CHEST_OPENING_FRAME_HEIGHT;

    context.clearRect(0, 0, width, height);
    context.drawImage(
      atlas.drawable,
      sourceX,
      sourceY,
      CHEST_OPENING_FRAME_WIDTH,
      CHEST_OPENING_FRAME_HEIGHT,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    lastDrawnFrameRef.current = frameIndex;
  }, [ensureAtlasImage]);

  const finishAnimation = useCallback(() => {
    if (animationCompletionModeRef.current !== "playing") return;
    animationCompletionModeRef.current = "ended";
    animationStartedRef.current = false;
    animationFrameRef.current = null;
    drawFrameRef.current(CHEST_OPENING_FRAME_COUNT - 1);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0;
      audio.pause();
    }

    revealAtAnimationTimestamp();
    if (animationEndCloseTimeoutRef.current !== null) {
      window.clearTimeout(animationEndCloseTimeoutRef.current);
    }
    animationEndCloseTimeoutRef.current = window.setTimeout(handleCollect, ANIMATION_LAST_FRAME_HOLD_MS);
  }, [handleCollect, revealAtAnimationTimestamp]);

  const animateOpening = useCallback((timestamp: number) => {
    const startedAt = animationStartTimeRef.current;
    if (startedAt === null || !animationStartedRef.current) return;

    const elapsed = Math.max(0, (timestamp - startedAt) / 1000);
    const animationTime = Math.min(elapsed, CHEST_OPENING_DURATION_SECONDS);
    const frameIndex = Math.min(
      CHEST_OPENING_FRAME_COUNT - 1,
      Math.floor(animationTime * CHEST_OPENING_FRAME_RATE),
    );
    drawFrameRef.current(frameIndex);

    if (elapsed >= REWARD_REVEAL_AT_SECONDS) {
      revealAtAnimationTimestamp();
    }

    const audio = audioRef.current;
    if (audio) {
      const fadeStart = CHEST_OPENING_DURATION_SECONDS - ANIMATION_AUDIO_FADE_DURATION_MS / 1000;
      audio.volume = animationTime >= fadeStart
        ? Math.max(0, (CHEST_OPENING_DURATION_SECONDS - animationTime) / (ANIMATION_AUDIO_FADE_DURATION_MS / 1000))
        : 1;

      if (audioStartedRef.current && !audio.paused && Math.abs(audio.currentTime - animationTime) > 0.16) {
        try {
          audio.currentTime = animationTime;
        } catch {
          // Keep the frame animation moving if a WebView rejects an audio seek.
        }
      }
    }

    if (elapsed >= CHEST_OPENING_DURATION_SECONDS) {
      finishAnimation();
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(animateOpening);
  }, [finishAnimation, revealAtAnimationTimestamp]);

  const startOpening = useCallback(() => {
    if (animationStartedRef.current || animationCompletionModeRef.current !== "playing") return;
    animationStartedRef.current = true;
    animationStartTimeRef.current = window.performance.now();
    audioStartedRef.current = false;
    drawFrameRef.current(0);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = 1;
      try {
        audio.currentTime = 0;
        const playResult = audio.play?.();
        if (playResult && typeof playResult.then === "function") {
          void playResult.then(() => {
            audioStartedRef.current = true;
          }).catch(() => {
            audioStartedRef.current = false;
          });
        } else {
          audioStartedRef.current = true;
        }
      } catch {
        audioStartedRef.current = false;
      }
    }

    if (!hasTriggeredOpenHapticRef.current) {
      hasTriggeredOpenHapticRef.current = true;
      try {
        vibrate("chest-open");
      } catch {
        // Optional haptics must not block the reward flow.
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(animateOpening);
  }, [animateOpening]);

  const attachCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    onOpeningReady?.(canvas ? startOpening : null);
  }, [onOpeningReady, startOpening]);

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    const generation = ++atlasGenerationRef.current;
    void ensureAtlasImage(0);
    void ensureAtlasImage(1);
    if (autoPlay) {
      void preloadChestOpeningFrames(tier.tier, 2).catch(() => undefined);
    }

    return () => {
      if (atlasGenerationRef.current === generation) atlasGenerationRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStartedRef.current = false;
      for (const atlas of loadedAtlasesRef.current.values()) atlas.release();
      loadedAtlasesRef.current.clear();
      atlasPromisesRef.current.clear();
      audioRef.current?.pause();
    };
  }, [autoPlay, ensureAtlasImage, tier.tier]);

  useEffect(() => {
    if (autoPlay) startOpening();
  }, [autoPlay, startOpening]);

  const skipOpeningToLastFrame = useCallback(() => {
    if (phase !== "playing" || animationCompletionModeRef.current !== "playing") return;

    animationCompletionModeRef.current = "skipped";
    animationStartedRef.current = false;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0;
      audio.pause();
    }
    drawFrameRef.current(CHEST_OPENING_FRAME_COUNT - 1);
    revealAtAnimationTimestamp();
  }, [phase, revealAtAnimationTimestamp]);

  const handleSurfacePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;

    const now = Date.now();
    if (now - lastTapAtRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastTapAtRef.current = 0;
      skipOpeningToLastFrame();
      return;
    }
    lastTapAtRef.current = now;
  }, [skipOpeningToLastFrame]);

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
      if (animationEndCloseTimeoutRef.current !== null) window.clearTimeout(animationEndCloseTimeoutRef.current);
      if (completeTimeoutRef.current !== null) window.clearTimeout(completeTimeoutRef.current);
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
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
      onDoubleClick={skipOpeningToLastFrame}
      className={cn(
        "relative flex h-full min-h-full w-full touch-manipulation items-center justify-center overflow-hidden bg-[#121212] px-4 py-6 text-center sm:px-6 sm:py-8",
        phase === "disappearing"
          ? "animate-chest-screen-close"
          : enterWithCss
            ? "animate-screen-pop"
            : "opacity-100",
      )}
    >
      <canvas
        ref={attachCanvasRef}
        aria-hidden="true"
        data-chest-opening-frames
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />
      <audio
        ref={audioRef}
        src={audioSource}
        preload="auto"
        aria-hidden="true"
        data-chest-opening-audio
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
        onPointsArrive={(awardedTotal) => {
          setDisplayPoints(stableTotalPoints + awardedTotal);
          setPointsDisplayPulse((current) => current + 1);
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
