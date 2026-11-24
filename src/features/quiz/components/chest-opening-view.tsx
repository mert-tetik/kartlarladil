"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Image from "next/image";
import { ScoreIcon } from "@/components/score-icon";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect, preloadSoundEffects } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import {
  NATIVE_MEDIA_LOCAL_HIT_EVENT,
  NATIVE_MEDIA_LOCAL_MISS_EVENT,
} from "@/lib/native-media-fallback";
import {
  CHEST_TIER_OPENING_AUDIO,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import {
  CHEST_OPENING_DURATION_SECONDS,
  CHEST_OPENING_FRAME_COUNT,
  CHEST_OPENING_FRAME_HEIGHT,
  CHEST_OPENING_FRAME_PREFETCH_AHEAD,
  CHEST_OPENING_FRAME_RATE,
  CHEST_OPENING_FRAME_WIDTH,
  getChestOpeningFrameSource,
  loadChestOpeningFrameImage,
} from "@/features/quiz/chest-opening-frames";
import { GEM_ASSETS, type ChestRewardOutcome, type GemBalances, type GemType } from "@/features/gems/gem-types";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { useAppMessage } from "@/components/app-message-provider";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import {
  finishCurrentWebAnimations,
  isQuizAnimationFastForwardDoubleTap,
} from "@/features/quiz/components/quiz-animation-fast-forward";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  totalPoints: number;
  onComplete: () => void;
  onRewardReady?: () => Promise<ChestRewardOutcome | null>;
  reward?: ChestRewardOutcome | null;
  enterWithCss?: boolean;
  autoPlay?: boolean;
  debugFramePlayback?: boolean;
  onOpeningReady?: (start: (() => void) | null) => void;
  onFastForwardHandlerChange?: (handler: (() => boolean) | null) => void;
}

type ChestPhase = "playing" | "revealed" | "disappearing";
type PointsPhase = "hidden" | "shown" | "flying" | "added";
const REWARD_REVEAL_AT_SECONDS = 3;
const REWARD_HOLD_BEFORE_FLIGHT_MS = 800;
const ANIMATION_LAST_FRAME_HOLD_MS = 2000;
const ANIMATION_AUDIO_FADE_DURATION_MS = 800;
const DISAPPEAR_MS = 500;
const TAP_MOVE_TOLERANCE_PX = 12;
const FRAME_RETRY_COOLDOWN_MS = 750;
const FIRST_FRAME_RETRY_DELAY_MS = 900;
const MAX_FIRST_FRAME_RETRIES = 1;

function retainChestFrameWindow(
  frames: Map<number, HTMLImageElement>,
  currentFrame: number,
  prefetchEndFrame: number,
) {
  const firstRetainedFrame = Math.max(0, currentFrame - 1);
  for (const [frameIndex, image] of frames) {
    if (frameIndex >= firstRetainedFrame && frameIndex <= prefetchEndFrame) continue;
    image.src = "data:,";
    frames.delete(frameIndex);
  }
}

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
  debugFramePlayback = false,
  onOpeningReady,
  onFastForwardHandlerChange,
}: ChestOpeningViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const { showMessage } = useAppMessage();
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
  const [scatterFastForwardSignal, setScatterFastForwardSignal] = useState(0);
  const [pointsSourcePulse, setPointsSourcePulse] = useState(0);
  const [gemSourcePulse, setGemSourcePulse] = useState<Record<GemType, number>>({ blue: 0, green: 0, purple: 0 });
  const [imageFrameRendererEnabled, setImageFrameRendererEnabled] = useState(false);
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
  const animationStartPendingRef = useRef(false);
  const animationStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTickRef = useRef<FrameRequestCallback>(() => undefined);
  const startOpeningRef = useRef<() => void>(() => undefined);
  const beginOpeningTimelineRef = useRef<() => void>(() => undefined);
  const lastRequestedFrameRef = useRef<number | null>(null);
  const lastDrawnFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<(frameIndex: number) => void>(() => undefined);
  const imageFrameFallbackRef = useRef<HTMLImageElement | null>(null);
  const imageFrameRendererEnabledRef = useRef(false);
  const imageFrameFallbackSourceRef = useRef("");
  const imageFrameFallbackIndexRef = useRef<number | null>(null);
  const waitingForFallbackFirstFrameRef = useRef(false);
  const frameFailureNoticeShownRef = useRef(false);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastFastForwardTapAtRef = useRef(0);
  const loadedFramesRef = useRef(new Map<number, HTMLImageElement>());
  const framePromisesRef = useRef(new Map<number, Promise<HTMLImageElement | null>>());
  const failedFrameRetryAtRef = useRef(new Map<number, number>());
  const frameGenerationRef = useRef(0);
  const firstFrameRetryCountRef = useRef(0);
  const firstFrameRetryTimeoutRef = useRef<number | null>(null);
  const frameDebugOutputRef = useRef<HTMLDivElement | null>(null);
  const frameDebugStateRef = useRef({
    status: "initializing",
    source: "—",
    context: "not checked",
    failures: 0,
    lastEvent: "—",
    error: "",
    nativeHitPath: "",
    nativeMissPath: "",
  });
  const frameDebugRefreshAtRef = useRef(0);
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
  const completionDeliveredRef = useRef(false);

  const reportFramePlaybackFailure = useCallback((
    frameIndex: number,
    reason: "load" | "draw",
  ) => {
    if (frameFailureNoticeShownRef.current) return;
    frameFailureNoticeShownRef.current = true;
    const path = getChestOpeningFrameSource(tier.tier, frameIndex).split("?")[0] ?? "";
    showMessage(
      t("chest.openingPlaybackFailed", {
        reason: t(reason === "load" ? "chest.openingFrameLoadReason" : "chest.openingFrameDrawReason"),
        path,
      }),
      "error",
      8_000,
    );
  }, [showMessage, t, tier.tier]);

  const updateFrameDebug = useCallback((
    patch: Partial<typeof frameDebugStateRef.current> |
      ((current: typeof frameDebugStateRef.current) => Partial<typeof frameDebugStateRef.current>),
  ) => {
    if (!debugFramePlayback) return;
    const nextPatch = typeof patch === "function" ? patch(frameDebugStateRef.current) : patch;
    Object.assign(frameDebugStateRef.current, nextPatch);

    const output = frameDebugOutputRef.current;
    if (!output) return;

    const state = frameDebugStateRef.current;
    const browserVersion = window.navigator.userAgent.match(/(?:Chrome|Chromium)\/([\d.]+)/)?.[1] ?? "unknown";
    const frameNumber = (index: number | null) => index === null ? "—" : String(index + 1).padStart(3, "0");
    const targetFrame = lastRequestedFrameRef.current;
    const drawnFrame = lastDrawnFrameRef.current;
    output.textContent = [
      `${tier.tier} · ${state.status}`,
      `Target ${frameNumber(targetFrame)} · drawn ${frameNumber(drawnFrame)} · cached ${loadedFramesRef.current.size}`,
      `Source ${state.source} · canvas ${state.context} · errors ${state.failures}`,
      state.error ? `Last error: ${state.error}` : `Chromium ${browserVersion} · ${state.lastEvent}`,
      state.nativeHitPath ? `Native local hit: ${state.nativeHitPath}` : "",
      state.nativeMissPath ? `Native local miss: ${state.nativeMissPath}` : "",
    ].filter(Boolean).join("\n");
  }, [debugFramePlayback, tier.tier]);

  const rewardGemSourceRefs = useMemo<Partial<Record<GemType, RefObject<HTMLElement | null>>>>(
    () => ({ blue: blueGemRewardRef, green: greenGemRewardRef, purple: purpleGemRewardRef }),
    [],
  );

  const displayFrameWithImageRenderer = useCallback((
    frameImage: HTMLImageElement,
    frameIndex: number,
    reason: string,
  ) => {
    imageFrameRendererEnabledRef.current = true;
    setImageFrameRendererEnabled(true);
    const source = frameImage.currentSrc || frameImage.src;
    imageFrameFallbackIndexRef.current = frameIndex;
    imageFrameFallbackSourceRef.current = source;

    const fallbackImage = imageFrameFallbackRef.current;
    if (fallbackImage && fallbackImage.getAttribute("src") !== source) {
      fallbackImage.setAttribute("src", source);
    }

    updateFrameDebug({
      status: "playing with image renderer",
      context: `image fallback (${reason})`,
      lastEvent: `showing frame ${String(frameIndex + 1).padStart(3, "0")}`,
    });
  }, [updateFrameDebug]);

  const handleImageRendererFrameLoad = useCallback((image: HTMLImageElement) => {
    if (!imageFrameRendererEnabledRef.current) return;
    if (image.getAttribute("src") !== imageFrameFallbackSourceRef.current) return;

    const frameIndex = imageFrameFallbackIndexRef.current;
    if (frameIndex === null || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      updateFrameDebug({
        status: "image renderer frame failed",
        context: "image fallback unavailable",
      });
      if (waitingForFallbackFirstFrameRef.current || lastDrawnFrameRef.current === null) {
        reportFramePlaybackFailure(frameIndex ?? 0, "load");
      }
      return;
    }

    lastDrawnFrameRef.current = frameIndex;
    updateFrameDebug({
      status: animationStartedRef.current ? "playing with image renderer" : "priming with image renderer",
      context: "image fallback ready",
      lastEvent: `painted frame ${String(frameIndex + 1).padStart(3, "0")}`,
    });

    if (waitingForFallbackFirstFrameRef.current && frameIndex === 0) {
      waitingForFallbackFirstFrameRef.current = false;
      beginOpeningTimelineRef.current();
    }
  }, [reportFramePlaybackFailure, updateFrameDebug]);

  const handleImageRendererFrameError = useCallback(() => {
    updateFrameDebug((current) => ({
      status: "image renderer frame failed",
      context: "image fallback unavailable",
      failures: current.failures + 1,
      lastEvent: `failed frame ${String((imageFrameFallbackIndexRef.current ?? 0) + 1).padStart(3, "0")}`,
    }));
    if (waitingForFallbackFirstFrameRef.current || lastDrawnFrameRef.current === null) {
      reportFramePlaybackFailure(imageFrameFallbackIndexRef.current ?? 0, "load");
    }
  }, [reportFramePlaybackFailure, updateFrameDebug]);

  useEffect(() => {
    if (!debugFramePlayback) return;

    const getChestFramePath = (path: unknown) => {
      if (
        typeof path !== "string" ||
        !path.startsWith("/chests/opening-frames/")
      ) {
        return null;
      }

      return path;
    };
    const handleNativeMediaLocalHit = (event: Event) => {
      const path = getChestFramePath((event as CustomEvent<{ path?: unknown }>).detail?.path);
      if (path) updateFrameDebug({ nativeHitPath: path, lastEvent: "native packaged frame hit" });
    };
    const handleNativeMediaLocalMiss = (event: Event) => {
      const path = getChestFramePath((event as CustomEvent<{ path?: unknown }>).detail?.path);
      if (path) updateFrameDebug({ nativeMissPath: path, lastEvent: "native packaged frame miss" });
    };

    window.addEventListener(NATIVE_MEDIA_LOCAL_HIT_EVENT, handleNativeMediaLocalHit);
    window.addEventListener(NATIVE_MEDIA_LOCAL_MISS_EVENT, handleNativeMediaLocalMiss);

    // Chest frames are preloaded before the opening overlay mounts, so native
    // hit/miss events can precede this listener. Read the persisted first
    // diagnostic as well as listening for events while the overlay is open.
    const diagnosticsWindow = window as Window & {
      __foxiesDeckNativeMediaDiagnostics?: Record<string, unknown>;
    };
    const diagnostics = diagnosticsWindow.__foxiesDeckNativeMediaDiagnostics;
    const nativeHitPath = getChestFramePath(diagnostics?.[NATIVE_MEDIA_LOCAL_HIT_EVENT]);
    const nativeMissPath = getChestFramePath(diagnostics?.[NATIVE_MEDIA_LOCAL_MISS_EVENT]);
    if (nativeHitPath || nativeMissPath) {
      updateFrameDebug((current) => ({
        nativeHitPath: nativeHitPath ?? current.nativeHitPath,
        nativeMissPath: nativeMissPath ?? current.nativeMissPath,
        lastEvent: nativeMissPath ? "native packaged frame miss" : "native packaged frame hit",
      }));
    }

    return () => {
      window.removeEventListener(NATIVE_MEDIA_LOCAL_HIT_EVENT, handleNativeMediaLocalHit);
      window.removeEventListener(NATIVE_MEDIA_LOCAL_MISS_EVENT, handleNativeMediaLocalMiss);
    };
  }, [debugFramePlayback, updateFrameDebug]);

  const formatRewardText = useCallback(
    (text: string) => (usesSuperWater ? formatSuperWaterText(locale, text) : text),
    [locale, usesSuperWater],
  );

  const revealAtAnimationTimestamp = useCallback(() => {
    if (rewardRevealTriggeredRef.current) return;
    rewardRevealTriggeredRef.current = true;
    setRewardRevealReady(true);
  }, []);

  const finishDisappear = useCallback(() => {
    if (completionDeliveredRef.current) return;
    completionDeliveredRef.current = true;
    if (completeTimeoutRef.current !== null) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
    onComplete();
  }, [onComplete]);

  const handleCollect = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    setPhase("disappearing");
    completeTimeoutRef.current = window.setTimeout(finishDisappear, DISAPPEAR_MS);
  }, [finishDisappear]);

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

  const ensureFrameImage = useCallback((frameIndex: number, allowDistantFrame = false) => {
    const loaded = loadedFramesRef.current.get(frameIndex);
    if (loaded) return Promise.resolve(loaded);

    const pending = framePromisesRef.current.get(frameIndex);
    if (pending) return pending;

    const retryAt = failedFrameRetryAtRef.current.get(frameIndex);
    if (retryAt !== undefined) {
      if (window.performance.now() < retryAt) return Promise.resolve(null);
      failedFrameRetryAtRef.current.delete(frameIndex);
    }

    const generation = frameGenerationRef.current;
    const request = (async () => {
      let image: HTMLImageElement | null = null;
      try {
        updateFrameDebug({ lastEvent: `loading frame ${String(frameIndex + 1).padStart(3, "0")}`, error: "" });
        image = await loadChestOpeningFrameImage(
          getChestOpeningFrameSource(tier.tier, frameIndex),
          (source) => updateFrameDebug({ source }),
        );

        if (generation !== frameGenerationRef.current) {
          image.src = "data:,";
          return null;
        }

        const requestedFrame = lastRequestedFrameRef.current;
        const lastDrawnFrame = lastDrawnFrameRef.current;
        if (lastDrawnFrame !== null && frameIndex <= lastDrawnFrame) {
          image.src = "data:,";
          return null;
        }
        if (!allowDistantFrame && requestedFrame !== null &&
          frameIndex > requestedFrame + CHEST_OPENING_FRAME_PREFETCH_AHEAD) {
          image.src = "data:,";
          return null;
        }

        loadedFramesRef.current.set(frameIndex, image);
        failedFrameRetryAtRef.current.delete(frameIndex);
        updateFrameDebug({ lastEvent: `decoded frame ${String(frameIndex + 1).padStart(3, "0")}` });
        if (requestedFrame !== null && frameIndex <= requestedFrame) {
          drawFrameRef.current(requestedFrame);
        }
        return image;
      } catch (error) {
        if (image) image.src = "data:,";
        if (generation === frameGenerationRef.current) {
          failedFrameRetryAtRef.current.set(
            frameIndex,
            window.performance.now() + FRAME_RETRY_COOLDOWN_MS,
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        updateFrameDebug((current) => ({
          status: frameIndex === 0 && !animationStartedRef.current
            ? "first frame load failed"
            : current.status,
          failures: current.failures + 1,
          lastEvent: `failed frame ${String(frameIndex + 1).padStart(3, "0")}`,
          error: message.slice(0, 100),
        }));
        return null;
      }
    })();

    framePromisesRef.current.set(frameIndex, request);
    void request.then(() => {
      if (framePromisesRef.current.get(frameIndex) === request) {
        framePromisesRef.current.delete(frameIndex);
      }
    });
    return request;
  }, [tier.tier, updateFrameDebug]);

  const drawFrame = useCallback((requestedFrame: number) => {
    const frameIndex = Math.max(0, Math.min(CHEST_OPENING_FRAME_COUNT - 1, requestedFrame));
    lastRequestedFrameRef.current = frameIndex;
    if (debugFramePlayback && window.performance.now() - frameDebugRefreshAtRef.current >= 250) {
      frameDebugRefreshAtRef.current = window.performance.now();
      updateFrameDebug({ status: animationStartedRef.current ? "playing" : "priming" });
    }

    void ensureFrameImage(frameIndex);
    const finalFrameToPrefetch = Math.min(
      CHEST_OPENING_FRAME_COUNT - 1,
      frameIndex + CHEST_OPENING_FRAME_PREFETCH_AHEAD,
    );
    for (let nextFrame = frameIndex + 1; nextFrame <= finalFrameToPrefetch; nextFrame += 1) {
      void ensureFrameImage(nextFrame);
    }

    const lastDrawnFrame = lastDrawnFrameRef.current;
    let frameToDraw = lastDrawnFrame !== null && loadedFramesRef.current.has(lastDrawnFrame)
      ? lastDrawnFrame
      : -1;
    for (const loadedIndex of loadedFramesRef.current.keys()) {
      if (loadedIndex <= frameIndex && loadedIndex > frameToDraw) {
        frameToDraw = loadedIndex;
      }
    }

    if (frameToDraw < 0) {
      updateFrameDebug({
        status: lastDrawnFrameRef.current === null ? "waiting for first frame" : "playing",
        lastEvent: `waiting for frame ${String(frameIndex + 1).padStart(3, "0")}`,
      });
      return;
    }

    const frameImage = loadedFramesRef.current.get(frameToDraw);
    if (!frameImage) return;

    if (imageFrameRendererEnabledRef.current) {
      retainChestFrameWindow(loadedFramesRef.current, frameToDraw, finalFrameToPrefetch);
      displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas previously unavailable");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas missing");
      return;
    }

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    } catch {
      // Older Android WebViews can reject optional context attributes.
    }
    if (!context) {
      try {
        context = canvas.getContext("2d");
      } catch {
        context = null;
      }
    }
    if (!context) {
      displayFrameWithImageRenderer(frameImage, frameToDraw, "2D context unavailable");
      return;
    }

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (
      lastDrawnFrameRef.current === frameToDraw &&
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight
    ) {
      return;
    }
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const scale = Math.max(width / CHEST_OPENING_FRAME_WIDTH, height / CHEST_OPENING_FRAME_HEIGHT);
    const drawWidth = CHEST_OPENING_FRAME_WIDTH * scale;
    const drawHeight = CHEST_OPENING_FRAME_HEIGHT * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    let firstFrameCanvasBaseline: Uint8ClampedArray | null = null;
    if (frameToDraw === 0) {
      try {
        const centerX = Math.min(canvas.width - 1, Math.floor(canvas.width / 2));
        const centerY = Math.min(canvas.height - 1, Math.floor(canvas.height / 2));
        firstFrameCanvasBaseline = context.getImageData(centerX, centerY, 1, 1).data;
      } catch {
        // A WebView that cannot read its canvas safely uses the DOM image path.
        displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas pixel verification unavailable");
        return;
      }
    }
    try {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, width, height);
      context.drawImage(
        frameImage,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateFrameDebug((current) => ({
        failures: current.failures + 1,
        error: message.slice(0, 100),
      }));
      displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas draw failed");
      return;
    }

    if (firstFrameCanvasBaseline) {
      try {
        const centerX = Math.min(canvas.width - 1, Math.floor(canvas.width / 2));
        const centerY = Math.min(canvas.height - 1, Math.floor(canvas.height / 2));
        const firstFrameCanvasPixel = context.getImageData(centerX, centerY, 1, 1).data;
        if (firstFrameCanvasPixel.every((channel, index) => channel === firstFrameCanvasBaseline?.[index])) {
          displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas produced no visible pixels");
          return;
        }
      } catch {
        displayFrameWithImageRenderer(frameImage, frameToDraw, "canvas pixel verification failed");
        return;
      }
    }

    lastDrawnFrameRef.current = frameToDraw;
    updateFrameDebug({
      status: animationStartedRef.current ? "playing" : "priming",
      context: "2D ready",
      lastEvent: `painted frame ${String(frameToDraw + 1).padStart(3, "0")}`,
    });

    retainChestFrameWindow(loadedFramesRef.current, frameToDraw, finalFrameToPrefetch);
  }, [debugFramePlayback, displayFrameWithImageRenderer, ensureFrameImage, updateFrameDebug]);

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

    animationFrameRef.current = window.requestAnimationFrame(animationTickRef.current);
  }, [finishAnimation, revealAtAnimationTimestamp]);

  const beginOpeningTimeline = useCallback(() => {
    if (animationStartedRef.current || animationCompletionModeRef.current !== "playing") return;
    animationStartedRef.current = true;
    animationTickRef.current = animateOpening;
    updateFrameDebug({ status: "playing" });
    animationStartTimeRef.current = window.performance.now();
    audioStartedRef.current = false;

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

    animationFrameRef.current = window.requestAnimationFrame(animateOpening);
  }, [animateOpening, updateFrameDebug]);

  const startOpening = useCallback(() => {
    if (
      animationStartedRef.current ||
      animationStartPendingRef.current ||
      animationCompletionModeRef.current !== "playing"
    ) return;

    animationStartPendingRef.current = true;
    const generation = frameGenerationRef.current;
    updateFrameDebug({ status: "waiting for first frame" });

    if (!hasTriggeredOpenHapticRef.current) {
      hasTriggeredOpenHapticRef.current = true;
      try {
        vibrate("chest-open");
      } catch {
        // Optional haptics must not block the reward flow.
      }
    }

    void ensureFrameImage(0).then((image) => {
      // A frame request can settle after the overlay has unmounted (or after
      // React re-runs the effect in development). Never let an old request
      // restart playback or schedule retries for a stale screen instance.
      if (generation !== frameGenerationRef.current) return;
      animationStartPendingRef.current = false;
      if (animationCompletionModeRef.current !== "playing") return;
      if (!image) {
        if (firstFrameRetryCountRef.current < MAX_FIRST_FRAME_RETRIES) {
          firstFrameRetryCountRef.current += 1;
          updateFrameDebug({
            status: "retrying first frame",
            lastEvent: `retrying frame 001 (${firstFrameRetryCountRef.current}/${MAX_FIRST_FRAME_RETRIES})`,
          });
          firstFrameRetryTimeoutRef.current = window.setTimeout(() => {
            firstFrameRetryTimeoutRef.current = null;
            startOpeningRef.current();
          }, FIRST_FRAME_RETRY_DELAY_MS);
          return;
        }

        updateFrameDebug({ status: "first frame unavailable" });
        reportFramePlaybackFailure(0, "load");
        return;
      }

      firstFrameRetryCountRef.current = 0;
      drawFrameRef.current(0);
      if (lastDrawnFrameRef.current !== 0) {
        if (imageFrameRendererEnabledRef.current) {
          waitingForFallbackFirstFrameRef.current = true;
          const fallbackImage = imageFrameFallbackRef.current;
          if (
            fallbackImage?.complete &&
            fallbackImage.naturalWidth > 0 &&
            fallbackImage.naturalHeight > 0
          ) {
            handleImageRendererFrameLoad(fallbackImage);
          } else {
            updateFrameDebug({
              status: "waiting for first image-rendered frame",
              context: "image fallback loading",
            });
          }
          return;
        }

        updateFrameDebug({
          status: "first frame decoded, canvas draw failed",
          context: "not drawing",
        });
        reportFramePlaybackFailure(0, "draw");
        return;
      }

      beginOpeningTimeline();
    });
  }, [beginOpeningTimeline, ensureFrameImage, handleImageRendererFrameLoad, reportFramePlaybackFailure, updateFrameDebug]);

  const attachCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    onOpeningReady?.(canvas ? startOpening : null);
  }, [onOpeningReady, startOpening]);

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    startOpeningRef.current = startOpening;
  }, [startOpening]);

  useEffect(() => {
    beginOpeningTimelineRef.current = beginOpeningTimeline;
  }, [beginOpeningTimeline]);

  useEffect(() => {
    preloadSoundEffects(["chest-skipped"]);
  }, []);

  useEffect(() => {
    const generation = ++frameGenerationRef.current;
    const loadedFrames = loadedFramesRef.current;
    const pendingFrameLoads = framePromisesRef.current;
    const failedFrameRetryTimes = failedFrameRetryAtRef.current;
    const audio = audioRef.current;
    lastRequestedFrameRef.current = 0;
    // Give frame 1 an uncontended load/decode path on slower WebViews. Once it
    // paints, drawFrame starts the bounded look-ahead for smooth playback.
    void ensureFrameImage(0);

    return () => {
      if (frameGenerationRef.current === generation) frameGenerationRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (firstFrameRetryTimeoutRef.current !== null) {
        window.clearTimeout(firstFrameRetryTimeoutRef.current);
        firstFrameRetryTimeoutRef.current = null;
      }
      animationStartedRef.current = false;
      animationStartPendingRef.current = false;
      firstFrameRetryCountRef.current = 0;
      for (const frame of loadedFrames.values()) frame.src = "data:,";
      loadedFrames.clear();
      pendingFrameLoads.clear();
      failedFrameRetryTimes.clear();
      imageFrameRendererEnabledRef.current = false;
      imageFrameFallbackSourceRef.current = "";
      imageFrameFallbackIndexRef.current = null;
      waitingForFallbackFirstFrameRef.current = false;
      audio?.pause();
    };
  }, [ensureFrameImage]);

  useEffect(() => {
    if (autoPlay) startOpening();
  }, [autoPlay, startOpening]);

  const skipOpeningToLastFrame = useCallback(() => {
    if (phase !== "playing" || animationCompletionModeRef.current !== "playing") return;

    animationCompletionModeRef.current = "skipped";
    animationStartedRef.current = false;
    if (firstFrameRetryTimeoutRef.current !== null) {
      window.clearTimeout(firstFrameRetryTimeoutRef.current);
      firstFrameRetryTimeoutRef.current = null;
    }
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
    playSoundEffect("chest-skipped");
  }, [phase, revealAtAnimationTimestamp]);

  const fastForwardCurrentChestAnimation = useCallback(() => {
    const root = screenRef.current;
    if (root) finishCurrentWebAnimations(root);

    if (phase === "disappearing") {
      finishDisappear();
      return true;
    }

    if (phase === "playing") {
      if (animationCompletionModeRef.current === "playing") {
        skipOpeningToLastFrame();
      } else {
        animationCompletionModeRef.current = "skipped";
        if (animationEndCloseTimeoutRef.current !== null) {
          window.clearTimeout(animationEndCloseTimeoutRef.current);
          animationEndCloseTimeoutRef.current = null;
        }
        revealAtAnimationTimestamp();
      }
      return true;
    }

    if (phase === "revealed") {
      animationCompletionModeRef.current = "skipped";
      if (animationEndCloseTimeoutRef.current !== null) {
        window.clearTimeout(animationEndCloseTimeoutRef.current);
        animationEndCloseTimeoutRef.current = null;
      }

      if (pointsPhase === "flying" || pointsPhase === "added") {
        setScatterFastForwardSignal((current) => current + 1);
        tryCompleteAfterSkippedScatter();
      } else {
        if (pointsTimeoutRef.current !== null) {
          window.clearTimeout(pointsTimeoutRef.current);
          pointsTimeoutRef.current = null;
        }
        if (rewardResolved) setPointsPhase("flying");
      }
      return true;
    }

    return false;
  }, [finishDisappear, phase, pointsPhase, rewardResolved, revealAtAnimationTimestamp, skipOpeningToLastFrame, tryCompleteAfterSkippedScatter]);

  useEffect(() => {
    onFastForwardHandlerChange?.(fastForwardCurrentChestAnimation);
    return () => onFastForwardHandlerChange?.(null);
  }, [fastForwardCurrentChestAnimation, onFastForwardHandlerChange]);

  const handleSurfacePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof event.button === "number" && event.button !== 0) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleSurfacePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof event.button === "number" && event.button !== 0) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_TOLERANCE_PX) {
      return;
    }
    if (event.target instanceof Element && event.target.closest(
      "button, a, input, select, textarea, [contenteditable='true']",
    )) return;
    if (!isQuizAnimationFastForwardDoubleTap(lastFastForwardTapAtRef)) return;

    if (fastForwardCurrentChestAnimation()) {
      vibrate("quiz-animation-fast-forward");
    }
  }, [fastForwardCurrentChestAnimation]);

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
    if (animationCompletionModeRef.current === "skipped") {
      setPointsPhase("flying");
      return;
    }
    setPointsPhase("shown");
    pointsTimeoutRef.current = window.setTimeout(() => {
      setPointsPhase("flying");
      pointsTimeoutRef.current = null;
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
      ref={screenRef}
      data-chest-opening-view
      data-chest-opening-layout
      data-no-quiz-fast-forward
      onPointerDown={handleSurfacePointerDown}
      onPointerUp={handleSurfacePointerUp}
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
      {/* Keep the native image node so the same decoded WebP sequence can render
          directly if an embedded WebView cannot create or draw on a 2D canvas. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Per-frame DOM fallback must bypass Next's image optimizer. */}
      <img
        ref={imageFrameFallbackRef}
        alt=""
        aria-hidden="true"
        data-chest-opening-image-fallback
        draggable={false}
        onLoad={(event) => handleImageRendererFrameLoad(event.currentTarget)}
        onError={handleImageRendererFrameError}
        className={cn(
          "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover",
          !imageFrameRendererEnabled && "hidden",
        )}
      />
      {debugFramePlayback ? (
        <div
          ref={frameDebugOutputRef}
          aria-live="off"
          data-chest-frame-debug
          className="pointer-events-none fixed bottom-2 left-2 z-[130] max-w-[calc(100vw-1rem)] whitespace-pre-wrap break-all rounded-md border border-white/25 bg-black/90 px-2 py-1.5 text-left font-mono text-[10px] leading-4 text-white/90 shadow-sm"
        >
          {`${tier.tier} · waiting for first frame\nTarget — · drawn — · cached 0\nSource — · canvas not checked · errors 0`}
        </div>
      ) : null}
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
        fastForwardSignal={scatterFastForwardSignal}
      />
    </div>
  );
}
