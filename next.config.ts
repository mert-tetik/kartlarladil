import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Keep the app shell online-first. Only image requests are persisted by the
// service worker, so authenticated pages and API responses never become stale.
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
  async redirects() {
    return [
      { source: "/kart-cek", destination: "/card-draw", permanent: true },
      { source: "/kartlarim", destination: "/my-cards", permanent: true },
      { source: "/ogren", destination: "/learn", permanent: true },
      { source: "/ogrenilenler", destination: "/learned", permanent: true },
      { source: "/profil", destination: "/profile", permanent: true },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  customWorkerSrc: "worker",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  cacheStartUrl: false,
  workboxOptions: {
    // Do not precache every public asset at service worker install time.
    // Images are cached lazily by the image-only runtime rule above.
    additionalManifestEntries: [],
    runtimeCaching: imageRuntimeCaching,
  },
})(nextConfig);
