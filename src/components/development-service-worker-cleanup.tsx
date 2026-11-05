"use client";

import { useEffect } from "react";

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

      if (cancelled) return;
    })().catch((error) => {
      console.warn("[FoxiesDeck dev] Could not clear the stale service worker.", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
