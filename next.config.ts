import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface ImageCacheManifest {
  assets: Array<{ url: string; revision: string }>;
  criticalAssets?: Array<{ url: string; revision: string }>;
}

function readImageCacheManifest(): ImageCacheManifest {
  const manifestPath = join(process.cwd(), "public", "image-cache-manifest.json");

  if (!existsSync(manifestPath)) {
    return { assets: [] };
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as ImageCacheManifest;
}

const imageCacheManifest = readImageCacheManifest();
const offlineShellManifestEntries = [
  "offline-shell/index.html",
  "offline-shell/offline-shell.js",
  "offline-shell/super-water.ttf",
  "offline-shell/foxies-mark.webp",
].flatMap((relativePath) => {
  const filePath = join(process.cwd(), "public", relativePath);
  if (!existsSync(filePath)) return [];

  return [{
    url: `/${relativePath}`,
    revision: createHash("sha256").update(readFileSync(filePath)).digest("hex"),
  }];
});

const precacheEntries = [
  ...(imageCacheManifest.criticalAssets ?? []),
  ...offlineShellManifestEntries,
];
const precacheEntriesByUrl = new Map(precacheEntries.map((entry) => [entry.url, entry]));

// Keep authenticated pages and API responses network-only. Images use runtime
// caching, while the compact offline shell is explicitly precached below.
const imageRuntimeCaching = [
  {
    urlPattern: ({ request }: { request: Request }) => request.destination === "image",
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "foxiesdeck-image-assets",
      expiration: {
        maxEntries: 240,
        maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
        purgeOnQuotaError: true,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@resvg/resvg-js", "ffmpeg-static", "sharp"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe"],
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/quiz/bonus_img.png",
        search: "?v=20261001-1",
      },
      {
        pathname: "/quiz/result-cards/star.png",
        search: "?v=20261003-2",
      },
      {
        pathname: "/quiz/quiz-word-repetition-teacher.png",
        search: "?v=20261008-2",
      },
      {
        pathname: "/quiz/quiz-word-repetition-teacher-1.png",
        search: "?v=20261008-1",
      },
      {
        pathname: "/quiz/continuation-motivations/**",
        search: "?v=20261005-1",
      },
      {
        pathname: "/quiz/result-cards/star.png",
        search: "?v=20261005-1",
      },
      {
        pathname: "/leaderboard-icon.png",
        search: "?v=20261005-1",
      },
      {
        pathname: "/mobile-nav-icons/**",
        search: "?v=20261006-2",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/kart-cek", destination: "/card-draw", permanent: true },
      { source: "/kartlarim", destination: "/my-cards", permanent: true },
      { source: "/ogren", destination: "/learn", permanent: true },
      { source: "/ogrenilenler", destination: "/learned", permanent: true },
      { source: "/profil", destination: "/profile", permanent: true },
      { source: "/twitter-automation", destination: "/content-automation", permanent: true },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  customWorkerSrc: "worker",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  // The root document contains session-dependent auth/profile state. Disabling
  // only cacheStartUrl still leaves next-pwa's dynamic NetworkFirst route on "/".
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    // Keep service worker installation small. The rest of the visual catalog
    // is filled by the TWA image cache gate after the app becomes interactive.
    additionalManifestEntries: [...precacheEntriesByUrl.values()],
    runtimeCaching: imageRuntimeCaching,
  },
  fallbacks: {
    document: "/~offline",
  },
})(nextConfig);
