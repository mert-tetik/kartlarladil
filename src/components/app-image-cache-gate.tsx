"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTwaMode } from "@/features/install-app/twa-mode";
import { useT } from "@/i18n/locale-provider";
import {
  getAssetsRequiringCache,
  getCriticalImageAssets,
  type ImageCacheAsset,
  type ImageCacheManifest,
} from "@/lib/image-cache-plan";

const IMAGE_CACHE_NAME = "foxiesdeck-image-assets";
const IMAGE_MANIFEST_URL = "/image-cache-manifest.json";
const IMAGE_MANIFEST_STORAGE_KEY = "foxiesdeck:image-cache-manifest";
const CRITICAL_IMAGE_CACHE_CONCURRENCY = 3;
const BACKGROUND_IMAGE_CACHE_CONCURRENCY = 2;
const BACKGROUND_CACHE_DELAY_MS = 1_200;
const EXIT_ANIMATION_DURATION_MS = 320;
const MAX_CACHE_GATE_DURATION_MS = 1_200;
const CACHE_REQUEST_TIMEOUT_MS = 2_500;

type CacheGatePhase = "hidden" | "loading" | "exiting";

export function AppImageCacheGate() {
  const t = useT();
  const [phase, setPhase] = useState<CacheGatePhase>("hidden");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!getTwaMode() || !("caches" in window)) {
      return;
    }

    let cancelled = false;
    let exitTimer: number | undefined;
    let cancelBackgroundCache: (() => void) | undefined;
    void Promise.resolve().then(async () => {
      if (cancelled) return;

      setPhase("loading");
      const criticalCachePromise = prepareCriticalImageCache((nextProgress) => {
        if (!cancelled) {
          setProgress(nextProgress);
        }
      });
      const cacheResultPromise = criticalCachePromise
        .then((manifest) => ({ kind: "complete" as const, manifest }))
        .catch(() => ({ kind: "failed" as const, manifest: null }));
      const gateResult = await Promise.race([
        cacheResultPromise,
        wait(MAX_CACHE_GATE_DURATION_MS).then(() => ({
          kind: "timed-out" as const,
          manifest: null,
        })),
      ]);

      if (cancelled) return;

      setPhase("exiting");
      exitTimer = window.setTimeout(() => setPhase("hidden"), EXIT_ANIMATION_DURATION_MS);

      if (gateResult.manifest) {
        cancelBackgroundCache = scheduleBackgroundImageCache(gateResult.manifest);
      } else if (gateResult.kind === "timed-out") {
        // Critical caching may still finish after the gate closes. Start the
        // full cache only then, so the two cache jobs never compete at launch.
        void criticalCachePromise
          .then((manifest) => {
            if (!cancelled && manifest) {
              cancelBackgroundCache = scheduleBackgroundImageCache(manifest);
            }
          })
          .catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
      if (exitTimer !== undefined) {
        window.clearTimeout(exitTimer);
      }
      cancelBackgroundCache?.();
    };
  }, []);

  if (phase === "hidden") {
    return null;
  }

  const percentage = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);

  return (
    <div
      aria-busy="true"
      aria-label={t("common.loading")}
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-[#f76808] px-8 text-white transition-[opacity,transform] duration-300 ease-out ${
        phase === "exiting" ? "pointer-events-none -translate-y-3 opacity-0" : "translate-y-0 opacity-100"
      }`}
      data-app-image-cache-gate
      role="status"
    >
      <div className="flex w-full max-w-[18rem] flex-col items-center">
        <div className="h-12 w-72 max-w-full overflow-hidden">
          <Image
            alt="FoxiesDeck"
            className="h-auto w-full -translate-y-[40%]"
            height={1024}
            priority
            src="/splash.png"
            width={1024}
          />
        </div>
        <p className="mt-8 text-sm font-semibold text-white">Loading</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${percentage / 100})`, transformOrigin: "left" }}
          />
        </div>
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    </div>
  );
}

async function prepareCriticalImageCache(
  onProgress: (progress: { completed: number; total: number }) => void,
) {
  const manifest = await readImageManifest();

  if (!manifest || manifest.assets.length === 0) {
    return null;
  }

  const cachedPaths = await getCachedPaths();
  const cachedManifest = readStoredManifest();
  const assetsToCache = getAssetsRequiringCache({
    candidates: getCriticalImageAssets(manifest),
    cachedPaths,
    cachedManifest,
  });

  if (assetsToCache.length > 0) {
    const cachedAssets = await cacheAssets(
      assetsToCache,
      onProgress,
      CRITICAL_IMAGE_CACHE_CONCURRENCY,
    );
    if (cachedAssets.length > 0) {
      storeCachedAssetRevisions(manifest, cachedManifest, cachedAssets);
    }
  }

  return manifest;
}

function scheduleBackgroundImageCache(manifest: ImageCacheManifest) {
  let idleCallbackId: number | undefined;
  let timeoutId: number | undefined;
  let cancelled = false;
  const browserWindow = window as typeof window & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  const cacheInBackground = () => {
    if (cancelled) return;
    void cacheRemainingImages(manifest).catch(() => undefined);
  };

  if (browserWindow.requestIdleCallback) {
    idleCallbackId = browserWindow.requestIdleCallback(cacheInBackground, {
      timeout: BACKGROUND_CACHE_DELAY_MS,
    });
  } else {
    timeoutId = window.setTimeout(cacheInBackground, BACKGROUND_CACHE_DELAY_MS);
  }

  return () => {
    cancelled = true;
    if (idleCallbackId !== undefined) {
      browserWindow.cancelIdleCallback?.(idleCallbackId);
    }
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
}

async function cacheRemainingImages(manifest: ImageCacheManifest) {
  const cachedPaths = await getCachedPaths();
  const cachedManifest = readStoredManifest();
  const assetsToCache = getAssetsRequiringCache({
    candidates: manifest.assets,
    cachedPaths,
    cachedManifest,
  });

  if (assetsToCache.length === 0) {
    return;
  }

  const cachedAssets = await cacheAssets(
    assetsToCache,
    () => undefined,
    BACKGROUND_IMAGE_CACHE_CONCURRENCY,
  );
  if (cachedAssets.length > 0) {
    storeCachedAssetRevisions(manifest, cachedManifest, cachedAssets);
  }
}

async function readImageManifest(): Promise<ImageCacheManifest | null> {
  try {
    const response = await fetchWithTimeout(IMAGE_MANIFEST_URL, { cache: "no-store" });

    if (!response.ok) {
      return readStoredManifest();
    }

    const manifest = (await response.json()) as unknown;
    return isImageManifest(manifest) ? manifest : readStoredManifest();
  } catch {
    return readStoredManifest();
  }
}

function readStoredManifest(): ImageCacheManifest | null {
  try {
    const stored = window.localStorage.getItem(IMAGE_MANIFEST_STORAGE_KEY);
    if (!stored) return null;

    const manifest = JSON.parse(stored) as unknown;
    return isImageManifest(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

function isImageManifest(value: unknown): value is ImageCacheManifest {
  if (!value || typeof value !== "object") return false;

  const manifest = value as Partial<ImageCacheManifest>;
  return (
    typeof manifest.version === "string" &&
    Array.isArray(manifest.assets) &&
    isImageAssetList(manifest.assets) &&
    (manifest.criticalAssets === undefined ||
      (Array.isArray(manifest.criticalAssets) && isImageAssetList(manifest.criticalAssets)))
  );
}

function isImageAssetList(assets: unknown[]): assets is ImageCacheAsset[] {
  return assets.every((asset) => {
    if (!asset || typeof asset !== "object") return false;

    const candidate = asset as Partial<ImageCacheAsset>;
    return typeof candidate.url === "string" && typeof candidate.revision === "string";
  });
}

function storeCachedAssetRevisions(
  manifest: ImageCacheManifest,
  cachedManifest: ImageCacheManifest | null,
  cachedAssets: ImageCacheAsset[],
) {
  const revisions = new Map(cachedManifest?.assets.map((asset) => [asset.url, asset.revision]));
  for (const asset of cachedAssets) {
    revisions.set(asset.url, asset.revision);
  }

  const cachedManifestAssets = manifest.assets.filter(
    (asset) => revisions.get(asset.url) === asset.revision,
  );
  window.localStorage.setItem(
    IMAGE_MANIFEST_STORAGE_KEY,
    JSON.stringify({
      version: manifest.version,
      assets: cachedManifestAssets,
      criticalAssets: manifest.criticalAssets,
    }),
  );
}

async function getCachedPaths(): Promise<Set<string>> {
  const cacheNames = await window.caches.keys();
  const pathSets = await Promise.all(
    cacheNames.map(async (cacheName) => {
      const cache = await window.caches.open(cacheName);
      const requests = await cache.keys();
      return requests.map((request) => toCachePath(request.url));
    }),
  );

  return new Set(pathSets.flat());
}

async function cacheAssets(
  assets: ImageCacheAsset[],
  onProgress: (progress: { completed: number; total: number }) => void,
  concurrency: number,
) {
  const cache = await window.caches.open(IMAGE_CACHE_NAME);
  let nextIndex = 0;
  let completed = 0;
  const cachedAssets: ImageCacheAsset[] = [];

  const cacheNextAsset = async () => {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex++];

      try {
        const requestUrl = new URL(asset.url, window.location.origin);
        requestUrl.searchParams.set("image-cache-revision", asset.revision);
        const response = await fetchWithTimeout(requestUrl, { cache: "reload" });

        if (response.ok) {
          await cache.put(asset.url, response.clone());
          cachedAssets.push(asset);
        }
      } catch {
        // A failed file remains absent from the cache and is retried next launch.
      } finally {
        completed += 1;
        onProgress({ completed, total: assets.length });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, assets.length) }, cacheNextAsset),
  );

  return cachedAssets;
}

function toCachePath(value: string): string {
  return new URL(value, window.location.origin).pathname;
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CACHE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}
