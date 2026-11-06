"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";

export type WebpFrameSequenceAssetId = "tutorial-welcome";

interface WebpFrameSequenceAsset {
  frameCount: number;
  fps: number;
  frameSource(index: number): string;
}

const ASSETS: Record<WebpFrameSequenceAssetId, WebpFrameSequenceAsset> = {
  "tutorial-welcome": {
    frameCount: 97,
    fps: 45,
    frameSource: (index) =>
      `/mascots/tutorial-welcome/frames/frame-${String(index + 1).padStart(3, "0")}.webp?v=20261104-webp-frames-1`,
  },
};

const DECODED_FRAME_CACHE_LIMIT = 20;
const FRAME_PRELOAD_CONCURRENCY = 8;
const INITIAL_DECODED_FRAME_COUNT = 16;
const inFlightFrameLoads = new Map<string, Promise<HTMLImageElement>>();
const decodedFrameCache = new Map<string, HTMLImageElement>();
const inFlightFrameBlobLoads = new Map<string, Promise<Blob>>();
const frameBlobCache = new Map<string, Blob>();
const frameObjectUrlCache = new Map<string, string>();

function loadFrameBlob(source: string): Promise<Blob> {
  const cached = frameBlobCache.get(source);
  if (cached) return Promise.resolve(cached);

  const inFlight = inFlightFrameBlobLoads.get(source);
  if (inFlight) return inFlight;

  const loading = fetch(source, { cache: "force-cache", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not load tutorial frame (${response.status}): ${source}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(`Tutorial frame was empty: ${source}`);
      frameBlobCache.set(source, blob);
      return blob;
    })
    .finally(() => inFlightFrameBlobLoads.delete(source));

  inFlightFrameBlobLoads.set(source, loading);
  return loading;
}

function getFrameObjectUrl(source: string, blob: Blob): string {
  const cached = frameObjectUrlCache.get(source);
  if (cached) return cached;

  if (typeof URL.createObjectURL !== "function") return source;

  try {
    const objectUrl = URL.createObjectURL(blob);
    frameObjectUrlCache.set(source, objectUrl);
    return objectUrl;
  } catch {
    return source;
  }
}

function loadDecodedFrame(source: string): Promise<HTMLImageElement> {
  const cached = decodedFrameCache.get(source);
  if (cached) {
    decodedFrameCache.delete(source);
    decodedFrameCache.set(source, cached);
    return Promise.resolve(cached);
  }

  const inFlight = inFlightFrameLoads.get(source);
  if (inFlight) return inFlight;

  const loading = loadFrameBlob(source).then((blob) => {
    const imageSource = getFrameObjectUrl(source, blob);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      let settled = false;
      let decoding: Promise<void> | null = null;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        if (error || image.naturalWidth === 0) {
          reject(error instanceof Error ? error : new Error(`Could not load tutorial frame: ${source}`));
        } else {
          resolve(image);
        }
      };
      const decode = () => {
        if (settled) return;
        if (typeof image.decode !== "function") {
          finish();
          return;
        }
        decoding ??= image.decode();
        void decoding.then(() => finish(), (error: unknown) => {
          // Some WebView versions reject decode() despite having loaded a usable image.
          if (image.complete && image.naturalWidth > 0) finish();
          else finish(error);
        });
      };

      image.decoding = "async";
      image.loading = "eager";
      image.fetchPriority = source.includes("frame-001.webp") ? "high" : "auto";
      image.onload = decode;
      image.onerror = () => finish(new Error(`Could not load tutorial frame: ${source}`));
      image.src = imageSource;
      if (image.complete && image.naturalWidth > 0) decode();
    });
  }).then((image) => {
    decodedFrameCache.delete(source);
    decodedFrameCache.set(source, image);
    while (decodedFrameCache.size > DECODED_FRAME_CACHE_LIMIT) {
      const oldestSource = decodedFrameCache.keys().next().value;
      if (oldestSource === undefined) break;
      decodedFrameCache.delete(oldestSource);
    }
    return image;
  }).finally(() => inFlightFrameLoads.delete(source));

  inFlightFrameLoads.set(source, loading);
  return loading;
}

/**
 * Fetch the requested sequence into the compressed in-memory cache, then decode
 * its opening frames so playback can start without a first-frame hitch.
 */
export function preloadWebpFrameSequence(assetId: WebpFrameSequenceAssetId, count = 16): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const asset = ASSETS[assetId];
  const frameCount = Math.min(Math.max(1, count), asset.frameCount);
  let nextFrameIndex = 0;
  let failed = false;

  const loadNextBatch = async () => {
    while (!failed) {
      const index = nextFrameIndex++;
      if (index >= frameCount) return true;

      try {
        await loadFrameBlob(asset.frameSource(index));
      } catch {
        failed = true;
        return false;
      }
    }

    return false;
  };

  const workerCount = Math.min(FRAME_PRELOAD_CONCURRENCY, frameCount);
  return Promise.all(Array.from({ length: workerCount }, () => loadNextBatch()))
    .then(async (results) => {
      if (!results.every(Boolean)) return false;

      const openingFrameCount = Math.min(INITIAL_DECODED_FRAME_COUNT, frameCount);
      const decodedFrames = await Promise.all(
        Array.from({ length: openingFrameCount }, (_, index) =>
          loadDecodedFrame(asset.frameSource(index)).then(() => true, () => false),
        ),
      );
      return decodedFrames.every(Boolean);
    })
    .catch(() => false);
}

export function getWebpFrameSequenceFrameCount(assetId: WebpFrameSequenceAssetId): number {
  return ASSETS[assetId].frameCount;
}

export function getWebpFrameSequenceFrameSource(assetId: WebpFrameSequenceAssetId, index: number): string {
  const asset = ASSETS[assetId];
  return asset.frameSource(Math.max(0, Math.min(asset.frameCount - 1, index)));
}

export interface WebpFrameSequencePlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
}

interface WebpFrameSequencePlayerProps {
  assetId: WebpFrameSequenceAssetId;
  className?: string;
  style?: CSSProperties;
  autoPlay?: boolean;
  loop?: boolean;
  onPlay?: (currentTime: number) => void;
  onPlaying?: (currentTime: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  onReady?: () => void;
  onError?: () => void;
  "data-testid"?: string;
  "data-player-id"?: string;
}

export const WebpFrameSequencePlayer = forwardRef<WebpFrameSequencePlayerHandle, WebpFrameSequencePlayerProps>(
  function WebpFrameSequencePlayer({
    assetId,
    className,
    style,
    autoPlay = false,
    loop = false,
    onPlay,
    onPlaying,
    onTimeUpdate,
    onEnded,
    onReady,
    onError,
    "data-testid": dataTestId,
    "data-player-id": dataPlayerId,
  }, ref) {
    const asset = ASSETS[assetId];
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const currentTimeRef = useRef(0);
    const pausedRef = useRef(true);
    const endedRef = useRef(false);
    const readyRef = useRef(false);
    const playRequestedRef = useRef(autoPlay);
    const startedAtRef = useRef(0);
    const frameRequestRef = useRef<number | null>(null);
    const lastTimeUpdateRef = useRef(0);
    const nextPrefetchIndexRef = useRef(1);
    const callbacksRef = useRef({ onPlay, onPlaying, onTimeUpdate, onEnded, onReady, onError });
    callbacksRef.current = { onPlay, onPlaying, onTimeUpdate, onEnded, onReady, onError };

    const startPlaybackRef = useRef<() => void>(() => undefined);
    const pausePlaybackRef = useRef<() => void>(() => undefined);
    const seekPlaybackRef = useRef<(seconds: number) => void>(() => undefined);

    useImperativeHandle(ref, () => ({
      play() {
        playRequestedRef.current = true;
        if (readyRef.current) startPlaybackRef.current();
      },
      pause() {
        playRequestedRef.current = false;
        pausePlaybackRef.current();
      },
      seek(seconds: number) {
        seekPlaybackRef.current(seconds);
      },
      get currentTime() {
        return currentTimeRef.current;
      },
      get duration() {
        return asset.frameCount / asset.fps;
      },
      get paused() {
        return pausedRef.current;
      },
      get ended() {
        return endedRef.current;
      },
    }), [asset]);

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { alpha: true });
      if (!canvas || !context) {
        playRequestedRef.current = false;
        callbacksRef.current.onError?.();
        return;
      }

      let disposed = false;
      let requestedDrawVersion = 0;
      let lastRequestedFrame = -1;

      const prefetchAhead = (frameIndex: number) => {
        const targetIndex = Math.min(asset.frameCount - 1, frameIndex + 12);
        while (nextPrefetchIndexRef.current <= targetIndex) {
          const index = nextPrefetchIndexRef.current++;
          void loadDecodedFrame(asset.frameSource(index)).catch(() => undefined);
        }
      };

      const drawFrame = (frameIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(asset.frameCount - 1, frameIndex));
        if (boundedIndex === lastRequestedFrame) return;
        lastRequestedFrame = boundedIndex;
        const drawVersion = ++requestedDrawVersion;

        void loadDecodedFrame(asset.frameSource(boundedIndex)).then((image) => {
          if (disposed || drawVersion !== requestedDrawVersion) return;
          const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
          const targetWidth = Math.round(image.naturalWidth * ratio);
          const targetHeight = Math.round(image.naturalHeight * ratio);
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
          context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

          if (!readyRef.current) {
            readyRef.current = true;
            callbacksRef.current.onReady?.();
            if (playRequestedRef.current) startPlaybackRef.current();
          }
        }).catch(() => {
          if (disposed) return;
          pausedRef.current = true;
          playRequestedRef.current = false;
          callbacksRef.current.onError?.();
        });
      };

      const tick = (timestamp: number) => {
        if (disposed || pausedRef.current) return;
        const duration = asset.frameCount / asset.fps;
        const elapsed = Math.max(0, (timestamp - startedAtRef.current) / 1000);
        if (elapsed >= duration) {
          if (loop) {
            currentTimeRef.current = 0;
            startedAtRef.current = timestamp;
            drawFrame(0);
            frameRequestRef.current = window.requestAnimationFrame(tick);
            return;
          }
          currentTimeRef.current = duration;
          drawFrame(asset.frameCount - 1);
          pausedRef.current = true;
          endedRef.current = true;
          frameRequestRef.current = null;
          callbacksRef.current.onTimeUpdate?.(duration);
          callbacksRef.current.onEnded?.();
          return;
        }

        currentTimeRef.current = elapsed;
        const frameIndex = Math.floor(elapsed * asset.fps);
        prefetchAhead(frameIndex);
        drawFrame(frameIndex);
        if (timestamp - lastTimeUpdateRef.current >= 100) {
          lastTimeUpdateRef.current = timestamp;
          callbacksRef.current.onTimeUpdate?.(elapsed);
        }
        frameRequestRef.current = window.requestAnimationFrame(tick);
      };

      startPlaybackRef.current = () => {
        if (disposed || !readyRef.current || !pausedRef.current) return;
        playRequestedRef.current = false;
        if (endedRef.current) {
          endedRef.current = false;
          currentTimeRef.current = 0;
          drawFrame(0);
        }
        pausedRef.current = false;
        prefetchAhead(Math.floor(currentTimeRef.current * asset.fps));
        startedAtRef.current = performance.now() - currentTimeRef.current * 1000;
        lastTimeUpdateRef.current = 0;
        callbacksRef.current.onPlay?.(currentTimeRef.current);
        callbacksRef.current.onPlaying?.(currentTimeRef.current);
        frameRequestRef.current = window.requestAnimationFrame(tick);
      };

      pausePlaybackRef.current = () => {
        if (pausedRef.current) return;
        currentTimeRef.current = Math.min(
          asset.frameCount / asset.fps,
          Math.max(0, (performance.now() - startedAtRef.current) / 1000),
        );
        pausedRef.current = true;
        if (frameRequestRef.current !== null) window.cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
        drawFrame(Math.min(asset.frameCount - 1, Math.floor(currentTimeRef.current * asset.fps)));
      };

      seekPlaybackRef.current = (seconds: number) => {
        const duration = asset.frameCount / asset.fps;
        currentTimeRef.current = Math.max(0, Math.min(duration, seconds));
        endedRef.current = currentTimeRef.current >= duration;
        if (!pausedRef.current) startedAtRef.current = performance.now() - currentTimeRef.current * 1000;
        drawFrame(Math.min(asset.frameCount - 1, Math.floor(currentTimeRef.current * asset.fps)));
      };

      currentTimeRef.current = 0;
      pausedRef.current = true;
      endedRef.current = false;
      readyRef.current = false;
      playRequestedRef.current = autoPlay;
      prefetchAhead(0);
      drawFrame(0);

      return () => {
        disposed = true;
        playRequestedRef.current = false;
        readyRef.current = false;
        pausedRef.current = true;
        if (frameRequestRef.current !== null) window.cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      };
    }, [asset, autoPlay, loop]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={className}
        style={style}
        data-webp-frame-sequence-player={assetId}
        data-player-id={dataPlayerId}
        data-testid={dataTestId}
      />
    );
  },
);
