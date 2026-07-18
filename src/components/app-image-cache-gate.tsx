"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTwaMode } from "@/features/install-app/twa-mode";
import { useT } from "@/i18n/locale-provider";

const IMAGE_CACHE_NAME = "foxiesdeck-image-assets";
const IMAGE_MANIFEST_URL = "/image-cache-manifest.json";
const IMAGE_MANIFEST_STORAGE_KEY = "foxiesdeck:image-cache-manifest";
const IMAGE_CACHE_CONCURRENCY = 6;

interface ImageAsset {
  url: string;
  revision: string;
}

interface ImageManifest {
  version: string;
  assets: ImageAsset[];
}

export function AppImageCacheGate() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!getTwaMode() || !("caches" in window)) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;

      setVisible(true);

      try {
        await prepareImageCache((nextProgress) => {
          if (!cancelled) {
            setProgress(nextProgress);
          }
        });
      } finally {
        if (!cancelled) {
          setVisible(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  const percentage = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);

  return (
    <div
      aria-busy="true"
      aria-label={t("common.loading")}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#f76808] px-8 text-white"
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

async function prepareImageCache(onProgress: (progress: { completed: number; total: number }) => void) {
  const manifest = await readImageManifest();

  if (!manifest || manifest.assets.length === 0) {
    return;
  }

  const cachedPaths = await getCachedPaths();
  const cachedManifest = readStoredManifest();
  const requiresRefresh = cachedManifest?.version !== manifest.version;
  const assetsToCache = requiresRefresh
    ? manifest.assets
    : manifest.assets.filter((asset) => !cachedPaths.has(toCachePath(asset.url)));

  if (assetsToCache.length > 0) {
    const failedAssets = await cacheAssets(assetsToCache, onProgress);

    if (failedAssets > 0) {
      return;
    }
  }

  window.localStorage.setItem(IMAGE_MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
}

async function readImageManifest(): Promise<ImageManifest | null> {
  try {
    const response = await fetch(IMAGE_MANIFEST_URL, { cache: "no-store" });

    if (!response.ok) {
      return readStoredManifest();
    }

    const manifest = (await response.json()) as unknown;
    return isImageManifest(manifest) ? manifest : readStoredManifest();
  } catch {
    return readStoredManifest();
  }
}

function readStoredManifest(): ImageManifest | null {
  try {
    const stored = window.localStorage.getItem(IMAGE_MANIFEST_STORAGE_KEY);
    if (!stored) return null;

    const manifest = JSON.parse(stored) as unknown;
    return isImageManifest(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

function isImageManifest(value: unknown): value is ImageManifest {
  if (!value || typeof value !== "object") return false;

  const manifest = value as Partial<ImageManifest>;
  return (
    typeof manifest.version === "string" &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(
      (asset) =>
        typeof asset?.url === "string" &&
        typeof asset?.revision === "string",
    )
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
  assets: ImageAsset[],
  onProgress: (progress: { completed: number; total: number }) => void,
) {
  const cache = await window.caches.open(IMAGE_CACHE_NAME);
  let nextIndex = 0;
  let completed = 0;
  let failedAssets = 0;

  const cacheNextAsset = async () => {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex++];

      try {
        const requestUrl = new URL(asset.url, window.location.origin);
        requestUrl.searchParams.set("image-cache-revision", asset.revision);
        const response = await fetch(requestUrl, { cache: "reload" });

        if (!response.ok) {
          failedAssets += 1;
        } else {
          await cache.put(asset.url, response.clone());
        }
      } catch {
        // A failed file remains absent from the cache and is retried next launch.
        failedAssets += 1;
      } finally {
        completed += 1;
        onProgress({ completed, total: assets.length });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CACHE_CONCURRENCY, assets.length) }, cacheNextAsset),
  );

  return failedAssets;
}

function toCachePath(value: string): string {
  return new URL(value, window.location.origin).pathname;
}
