"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import {
  getVideoFrameAtlasCount,
  getVideoFrameAtlasSource,
  VIDEO_FRAME_ATLAS_ASSETS,
  type VideoFrameAtlasAssetId,
} from "@/lib/video-frame-atlas-assets";

export interface VideoFrameAtlasPlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
}

interface VideoFrameAtlasPlayerProps {
  assetId: VideoFrameAtlasAssetId;
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

const inFlightAtlasLoads = new Map<string, Promise<HTMLImageElement>>();
const decodedAtlasCache = new Map<string, HTMLImageElement>();
const MAX_CACHED_DECODED_ATLASES = 2;

function loadAtlas(source: string): Promise<HTMLImageElement> {
  const decoded = decodedAtlasCache.get(source);
  if (decoded) {
    decodedAtlasCache.delete(source);
    decodedAtlasCache.set(source, decoded);
    return Promise.resolve(decoded);
  }

  const inFlight = inFlightAtlasLoads.get(source);
  if (inFlight) return inFlight;

  const loadImage = (imageSource: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const resolveDecodedImage = () => {
      if (settled) return;
      settled = true;
      resolve(image);
    };
    const rejectImage = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    let decoding: Promise<void> | null = null;
    const decodeImage = () => {
      if (typeof image.decode !== "function") return Promise.resolve();
      decoding ??= image.decode();
      return decoding;
    };
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = source.includes("/video-frame-atlases/tutorial-welcome/atlas-001.webp") ? "high" : "auto";
    image.onload = () => {
      void decodeImage().then(resolveDecodedImage).catch((error: unknown) => {
        rejectImage(error instanceof Error ? error : new Error(`Could not decode video frame atlas: ${imageSource}`));
      });
    };
    image.onerror = () => rejectImage(new Error(`Could not load video frame atlas: ${imageSource}`));
    image.src = imageSource;
    if (typeof image.decode === "function") {
      void decodeImage().then(resolveDecodedImage).catch((error: unknown) => {
        rejectImage(error instanceof Error ? error : new Error(`Could not decode video frame atlas: ${imageSource}`));
      });
    }
  });

  const loading = loadImage(source)
    .catch(() => loadImage(`${source}&retry=1`))
    .then((image) => {
      decodedAtlasCache.delete(source);
      decodedAtlasCache.set(source, image);
      while (decodedAtlasCache.size > MAX_CACHED_DECODED_ATLASES) {
        const leastRecentlyUsed = decodedAtlasCache.keys().next().value;
        if (leastRecentlyUsed === undefined) break;
        decodedAtlasCache.delete(leastRecentlyUsed);
      }
      return image;
    })
    .finally(() => inFlightAtlasLoads.delete(source));
  inFlightAtlasLoads.set(source, loading);
  return loading;
}

export function preloadVideoFrameAtlas(assetId: VideoFrameAtlasAssetId, count = 2): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const atlasCount = getVideoFrameAtlasCount(assetId);
  const indexes = Array.from({ length: Math.min(count, atlasCount) }, (_, index) => index);
  return Promise.all(indexes.map((index) =>
    loadAtlas(getVideoFrameAtlasSource(assetId, index)).then(() => true, () => false),
  )).then((results) => results.length === indexes.length && results.every(Boolean));
}

export const VideoFrameAtlasPlayer = forwardRef<VideoFrameAtlasPlayerHandle, VideoFrameAtlasPlayerProps>(
  function VideoFrameAtlasPlayer({
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
    const asset = VIDEO_FRAME_ATLAS_ASSETS[assetId];
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const currentTimeRef = useRef(0);
    const pausedRef = useRef(true);
    const endedRef = useRef(false);
    const readyRef = useRef(false);
    const playRequestedRef = useRef(autoPlay);
    const startedAtRef = useRef(0);
    const frameRequestRef = useRef<number | null>(null);
    const lastTimeUpdateRef = useRef(0);
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

      const framesPerAtlas = asset.columns * asset.rows;
      const decodedAtlases = new Map<number, HTMLImageElement>();
      const atlasPromises = new Map<number, Promise<HTMLImageElement>>();
      let disposed = false;
      let readyNotified = false;
      let errorNotified = false;
      let requestedDrawVersion = 0;
      let lastRequestedFrame = -1;

      const getAtlas = (atlasIndex: number) => {
        const decoded = decodedAtlases.get(atlasIndex);
        if (decoded) return Promise.resolve(decoded);
        const pending = atlasPromises.get(atlasIndex);
        if (pending) return pending;

        const loading = loadAtlas(getVideoFrameAtlasSource(assetId, atlasIndex)).then((image) => {
          if (!disposed) decodedAtlases.set(atlasIndex, image);
          atlasPromises.delete(atlasIndex);
          return image;
        }).catch((error: unknown) => {
          atlasPromises.delete(atlasIndex);
          throw error;
        });
        atlasPromises.set(atlasIndex, loading);
        return loading;
      };

      const trimAtlasCache = (activeIndex: number) => {
        for (const atlasIndex of decodedAtlases.keys()) {
          if (atlasIndex !== activeIndex && atlasIndex !== activeIndex + 1) {
            decodedAtlases.delete(atlasIndex);
          }
        }
      };

      const drawFrame = (frameIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(asset.frameCount - 1, frameIndex));
        if (boundedIndex === lastRequestedFrame) return;
        lastRequestedFrame = boundedIndex;
        const atlasIndex = Math.floor(boundedIndex / framesPerAtlas);
        const drawVersion = ++requestedDrawVersion;

        void getAtlas(atlasIndex).then((atlas) => {
          if (disposed || drawVersion !== requestedDrawVersion) return;
          const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
          const targetWidth = Math.round(asset.frameWidth * ratio);
          const targetHeight = Math.round(asset.frameHeight * ratio);
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.clearRect(0, 0, asset.frameWidth, asset.frameHeight);
          const localIndex = boundedIndex % framesPerAtlas;
          const sourceX = (localIndex % asset.columns) * asset.frameWidth;
          const sourceY = Math.floor(localIndex / asset.columns) * asset.frameHeight;
          context.drawImage(
            atlas,
            sourceX,
            sourceY,
            asset.frameWidth,
            asset.frameHeight,
            0,
            0,
            asset.frameWidth,
            asset.frameHeight,
          );
          trimAtlasCache(atlasIndex);

          if (!readyNotified) {
            readyNotified = true;
            readyRef.current = true;
            callbacksRef.current.onReady?.();
            if (playRequestedRef.current) startPlaybackRef.current();
          }
          if (atlasIndex + 1 < getVideoFrameAtlasCount(assetId)) {
            void getAtlas(atlasIndex + 1).catch(() => undefined);
          }
        }).catch(() => {
          if (disposed || errorNotified) return;
          errorNotified = true;
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
        drawFrame(Math.floor(elapsed * asset.fps));
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
        drawFrame(Math.floor(currentTimeRef.current * asset.fps));
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
      drawFrame(0);

      return () => {
        disposed = true;
        playRequestedRef.current = false;
        readyRef.current = false;
        pausedRef.current = true;
        if (frameRequestRef.current !== null) window.cancelAnimationFrame(frameRequestRef.current);
        decodedAtlases.clear();
      };
    }, [asset, assetId, autoPlay, loop]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={className}
        style={style}
        data-video-frame-atlas-player={assetId}
        data-player-id={dataPlayerId}
        data-testid={dataTestId}
      />
    );
  },
);
