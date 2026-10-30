"use client";

import { useEffect } from "react";

const CLEANUP_RELOAD_KEY = "foxiesdeck:dev-service-worker-cleaned";

export function DevelopmentServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;

      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      if (cancelled || sessionStorage.getItem(CLEANUP_RELOAD_KEY) === "1") return;

      sessionStorage.setItem(CLEANUP_RELOAD_KEY, "1");
      window.location.reload();
    })().catch((error) => {
      console.warn("[FoxiesDeck dev] Could not clear the stale service worker.", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
