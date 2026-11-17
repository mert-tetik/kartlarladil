"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/features/auth/auth-client";
import { getTwaMode } from "@/features/install-app/twa-mode";
import {
  PERFORMANCE_DIAGNOSTICS_CONSENT_EVENT,
  PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
  PERFORMANCE_DIAGNOSTICS_QUEUE_PREFIX,
} from "@/lib/performance-diagnostics-contract";
import {
  acknowledgeNativePerformanceSnapshot,
  clearPendingPerformanceEvents,
  createPerformanceDiagnosticEvent,
  enqueuePerformanceEvent,
  getPerformanceDiagnosticsConsent,
  flushPendingPerformanceEvents,
  getNativePerformanceSnapshots,
  hashPerformanceOwner,
  readNativePerformanceDevice,
  setNativePerformanceConsent,
  type PerformanceDiagnosticDevice,
} from "@/lib/performance-diagnostics";
import { subscribeRouteTransition } from "@/lib/route-transition";

const FPS_SAMPLE_DURATION_MS = 5_000;
const FPS_SAMPLE_INTERVAL_MS = 300_000;

function routeCategory(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname === "/learn") return "learn";
  if (pathname === "/learned") return "learned";
  if (pathname === "/card-draw") return "card_draw";
  if (pathname === "/my-cards") return "my_cards";
  if (pathname === "/profile") return "profile";
  if (pathname === "/leaderboard") return "leaderboard";
  if (pathname.startsWith("/ai-practice")) return "ai_practice";
  if (pathname.startsWith("/ask/")) return "ask";
  if (pathname === "/pricing") return "pricing";
  if (pathname.startsWith("/account/")) return "account";
  if (pathname.startsWith("/games/")) return "games";
  return "other";
}

export function PerformanceDiagnosticsProvider() {
  const pathname = usePathname();
  const { user, isSessionReady } = useAuthSession();
  const [isDiagnosticsEnabled, setIsDiagnosticsEnabled] = useState(false);
  const enabledRef = useRef(false);
  const deviceRef = useRef<PerformanceDiagnosticDevice | null>(null);
  const userIdRef = useRef<string | null>(null);
  const navigationStartRef = useRef<number | null>(null);
  const previousPathRef = useRef(pathname);
  const flushInFlightRef = useRef(false);
  const flushRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const userId = user?.id;
    userIdRef.current = userId ?? null;
    enabledRef.current = false;
    setIsDiagnosticsEnabled(false);
    deviceRef.current = null;
    if (!isSessionReady || !userId || !getTwaMode()) return;

    let disposed = false;
    const ownerHashPromise = hashPerformanceOwner(userId).catch(() => "");
    const activate = async () => {
      const consent = await getPerformanceDiagnosticsConsent(userId);
      if (disposed) return;
      const enabled = consent.enabled === true && consent.policy_version === PERFORMANCE_DIAGNOSTICS_POLICY_VERSION;
      if (!enabled) {
        enabledRef.current = false;
        setIsDiagnosticsEnabled(false);
        deviceRef.current = null;
        clearPendingPerformanceEvents(userId);
        setNativePerformanceConsent(false);
        return;
      }

      const ownerHash = await ownerHashPromise;
      const device = readNativePerformanceDevice();
      if (!device || disposed) return;
      enabledRef.current = true;
      setIsDiagnosticsEnabled(true);
      deviceRef.current = device;
      setNativePerformanceConsent(true, ownerHash);

      const snapshots = await getNativePerformanceSnapshots();
      for (const snapshot of snapshots) {
        if (snapshot.owner_hash !== ownerHash) {
          acknowledgeNativePerformanceSnapshot(snapshot.event_id);
          continue;
        }
        const { owner_hash: _ownerHash, ...event } = snapshot;
        enqueuePerformanceEvent(userId, event);
        acknowledgeNativePerformanceSnapshot(snapshot.event_id);
      }
      await flush();
    };

    const flush = async () => {
      if (flushInFlightRef.current || disposed || !enabledRef.current) return;
      flushInFlightRef.current = true;
      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const status = await flushPendingPerformanceEvents(userId);
          if (status === "consent_required") {
            enabledRef.current = false;
            deviceRef.current = null;
            clearPendingPerformanceEvents(userId);
            setNativePerformanceConsent(false);
            break;
          }
          if (status !== "sent") break;
          let hasMore = false;
          try {
            const raw = window.localStorage.getItem(`${PERFORMANCE_DIAGNOSTICS_QUEUE_PREFIX}${userId}`);
            hasMore = !!raw && JSON.parse(raw).length > 0;
          } catch {
            break;
          }
          if (!hasMore) break;
        }
      } finally {
        flushInFlightRef.current = false;
      }
    };
    flushRef.current = () => void flush();

    const onConsentChanged = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled === true;
      if (!enabled) {
        enabledRef.current = false;
        setIsDiagnosticsEnabled(false);
        deviceRef.current = null;
      clearPendingPerformanceEvents(userId);
        setNativePerformanceConsent(false);
        return;
      }
      void activate().catch(() => undefined);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const flushTimer = window.setInterval(() => void flush(), 30_000);
    window.addEventListener(PERFORMANCE_DIAGNOSTICS_CONSENT_EVENT, onConsentChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void activate().catch(() => undefined);

    return () => {
      disposed = true;
      enabledRef.current = false;
      deviceRef.current = null;
      window.clearInterval(flushTimer);
      window.removeEventListener(PERFORMANCE_DIAGNOSTICS_CONSENT_EVENT, onConsentChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushRef.current = () => undefined;
    };
  }, [isSessionReady, user?.id]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const startedAt = navigationStartRef.current;
    navigationStartRef.current = null;
    if (startedAt === null) return;

    let secondFrame = 0;
    let settleFrameOne = 0;
    let settleFrameTwo = 0;
    let transitionTimeout: number | null = null;
    let transitionObserver: MutationObserver | null = null;
    let active = true;
    let completed = false;

    const recordNavigation = () => {
      if (!active || completed) return;
      completed = true;
      const duration = Math.max(0, Math.round(window.performance.now() - startedAt));
      if (!enabledRef.current || !deviceRef.current || !userIdRef.current) return;
      enqueuePerformanceEvent(userIdRef.current, createPerformanceDiagnosticEvent(deviceRef.current, {
        navigation_ms: duration,
        navigation_route: routeCategory(pathname),
      }));
      flushRef.current();
    };

    const recordAfterPaint = () => {
      settleFrameOne = window.requestAnimationFrame(() => {
        settleFrameTwo = window.requestAnimationFrame(recordNavigation);
      });
    };

    const waitForRouteTransition = () => {
      if (!document.documentElement.dataset.routeTransition) {
        recordNavigation();
        return;
      }

      const finishTransition = () => {
        if (completed) return;
        transitionObserver?.disconnect();
        transitionObserver = null;
        if (transitionTimeout !== null) window.clearTimeout(transitionTimeout);
        transitionTimeout = null;
        recordAfterPaint();
      };

      transitionObserver = new MutationObserver(() => {
        if (!document.documentElement.dataset.routeTransition) finishTransition();
      });
      transitionObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-route-transition"],
      });
      transitionTimeout = window.setTimeout(finishTransition, 15_000);
      if (!document.documentElement.dataset.routeTransition) finishTransition();
    };

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(waitForRouteTransition);
    });
    return () => {
      active = false;
      transitionObserver?.disconnect();
      if (transitionTimeout !== null) window.clearTimeout(transitionTimeout);
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (settleFrameOne) window.cancelAnimationFrame(settleFrameOne);
      if (settleFrameTwo) window.cancelAnimationFrame(settleFrameTwo);
    };
  }, [pathname]);

  useEffect(() => {
    const unsubscribe = subscribeRouteTransition(
      () => {
        navigationStartRef.current = enabledRef.current ? window.performance.now() : null;
      },
      () => {
        navigationStartRef.current = null;
      },
    );
    const onPopState = () => {
      navigationStartRef.current = enabledRef.current ? window.performance.now() : null;
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;
    let animationFrameId: number | null = null;
    let stopped = false;

    const scheduleNext = () => {
      if (!enabledRef.current || document.visibilityState === "hidden" || stopped) return;
      timeoutId = window.setTimeout(runSample, FPS_SAMPLE_INTERVAL_MS);
    };

    const runSample = () => {
      if (!enabledRef.current || document.visibilityState === "hidden" || stopped) {
        scheduleNext();
        return;
      }

      const startedAt = window.performance.now();
      let previousFrameAt = startedAt;
      let renderedFrames = 0;
      let jankyFrames = 0;
      const sampleFrame = (now: number) => {
        if (stopped || !enabledRef.current) return;
        const delta = now - previousFrameAt;
        if (renderedFrames > 0 && delta > 50) jankyFrames += 1;
        previousFrameAt = now;
        renderedFrames += 1;
        if (now - startedAt >= FPS_SAMPLE_DURATION_MS) {
          const duration = Math.round(now - startedAt);
          const device = deviceRef.current;
          const userId = userIdRef.current;
          if (device && userId && renderedFrames > 1) {
            enqueuePerformanceEvent(userId, createPerformanceDiagnosticEvent(device, {
              fps_average: Math.min(240, Math.round((renderedFrames / (duration / 1000)) * 10) / 10),
              fps_duration_ms: duration,
              rendered_frames: renderedFrames,
              janky_frames: jankyFrames,
            }));
            flushRef.current();
          }
          scheduleNext();
          return;
        }
        animationFrameId = window.requestAnimationFrame(sampleFrame);
      };
      animationFrameId = window.requestAnimationFrame(sampleFrame);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      } else {
        scheduleNext();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (isDiagnosticsEnabled) runSample();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [isDiagnosticsEnabled]);

  return null;
}
