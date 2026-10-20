"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Wifi } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { SlowConnectionMonitorErrorBoundary } from "@/components/slow-connection-monitor-error-boundary";
import {
  logSlowConnectionMonitorError,
  logSlowConnectionMonitorWarning,
} from "@/components/slow-connection-monitor-logger";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { useTheme } from "@/components/theme-provider";
import { getAccessibleForeground } from "@/lib/color-contrast";
import {
  estimateResourceTransfer,
  CUSTOM_CARD_GENERATION_STALLED_EVENT,
  isSlowConnectionEstimate,
  isSlowReachabilitySample,
  MIN_RESOURCE_TRANSFER_BYTES,
  SLOW_RESOURCE_THROUGHPUT_MBPS,
  shouldRecommendOfflineMode,
  VERY_SLOW_CONNECTION_LATENCY_MS,
  type NetworkConnectionEstimate,
} from "@/lib/slow-connection-quality";
import { cn } from "@/lib/utils";

interface NetworkInformationLike extends EventTarget, NetworkConnectionEstimate {}

interface NavigatorWithNetworkInformation extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

const PROMPT_COOLDOWN_MS = 15 * 60 * 1_000;
const PROBE_INTERVAL_MS = 30 * 1_000;
const CONFIRMATION_DELAY_MS = 2_500;
const PROBE_TIMEOUT_MS = 12_000;
const RECENT_RESOURCE_WINDOW_MS = 60_000;
const MAX_SEEN_RESOURCE_ENTRIES = 512;
const PROMPT_DISMISSAL_KEY = "foxiesdeck:slow-connection-prompt-dismissed-until:v1";

function getNetworkInformation(): NetworkInformationLike | null {
  try {
    const browserNavigator = navigator as NavigatorWithNetworkInformation;
    return browserNavigator.connection ?? browserNavigator.mozConnection ?? browserNavigator.webkitConnection ?? null;
  } catch (error) {
    logSlowConnectionMonitorError("could not read the browser network estimate", error);
    return null;
  }
}

function getOnlineStatus(): boolean | null {
  try {
    return typeof navigator.onLine === "boolean" ? navigator.onLine : null;
  } catch (error) {
    logSlowConnectionMonitorError("could not read navigator.onLine", error);
    return null;
  }
}

function getVisibilityState(): DocumentVisibilityState | null {
  try {
    return typeof document.visibilityState === "string" ? document.visibilityState : null;
  } catch (error) {
    logSlowConnectionMonitorError("could not read document.visibilityState", error);
    return null;
  }
}

function getMonotonicNow() {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      const value = performance.now();
      if (Number.isFinite(value)) return value;
    }
  } catch (error) {
    logSlowConnectionMonitorError("performance.now failed; using the wall clock", error);
  }

  return Date.now();
}

function getErrorKey(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return String(error);
}

function addMonitorEventListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  context: string,
) {
  try {
    target.addEventListener(type, listener);
    return () => {
      try {
        target.removeEventListener(type, listener);
      } catch (error) {
        logSlowConnectionMonitorError(`could not remove ${context} listener`, error);
      }
    };
  } catch (error) {
    logSlowConnectionMonitorError(`could not add ${context} listener`, error);
    return () => undefined;
  }
}

function isOfflineRoute(pathname: string | null) {
  return pathname === "/offline"
    || pathname === "/~offline"
    || pathname === "/visual-test-offline";
}

export function SlowConnectionMonitor() {
  return (
    <SlowConnectionMonitorErrorBoundary>
      <SlowConnectionMonitorContent />
    </SlowConnectionMonitorErrorBoundary>
  );
}

function SlowConnectionMonitorContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useLocale();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const isVisualTestRef = useRef(false);
  const offlineButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const seenResourceEntriesRef = useRef(new Set<string>());
  const pathnameRef = useRef(pathname);
  const previousPathnameRef = useRef(pathname);
  const launchProbeRef = useRef<(() => void) | null>(null);
  const cancelProbeRef = useRef<(() => void) | null>(null);

  const openPrompt = useCallback(() => {
    try {
      if (isOpenRef.current) return;

      if (!isVisualTestRef.current) {
        try {
          const dismissedUntil = Number(window.sessionStorage.getItem(PROMPT_DISMISSAL_KEY));
          if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;
        } catch (error) {
          logSlowConnectionMonitorWarning("could not read prompt dismissal state", error);
        }
      }

      isOpenRef.current = true;
      setIsOpen(true);
    } catch (error) {
      isOpenRef.current = false;
      logSlowConnectionMonitorError("could not open the low-connection prompt", error);
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    try {
      if (!isVisualTestRef.current) {
        try {
          window.sessionStorage.setItem(
            PROMPT_DISMISSAL_KEY,
            String(Date.now() + PROMPT_COOLDOWN_MS),
          );
        } catch (error) {
          logSlowConnectionMonitorWarning("could not persist prompt dismissal state", error);
        }
      }

      isOpenRef.current = false;
      setIsOpen(false);
    } catch (error) {
      logSlowConnectionMonitorError("could not dismiss the low-connection prompt", error);
    }
  }, []);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    pathnameRef.current = pathname;
    previousPathnameRef.current = pathname;

    if (isOfflineRoute(pathname)) {
      cancelProbeRef.current?.();
      if (isOpenRef.current) dismissPrompt();
      return;
    }

    if (isOfflineRoute(previousPathname)) launchProbeRef.current?.();
  }, [dismissPrompt, pathname]);

  useEffect(() => {
    function handleCustomCardGenerationStalled() {
      try {
        if (getOnlineStatus() === true && !isOfflineRoute(pathnameRef.current)) openPrompt();
      } catch (error) {
        logSlowConnectionMonitorError("custom-card stall handler failed", error);
      }
    }

    const removeListener = addMonitorEventListener(
      window,
      CUSTOM_CARD_GENERATION_STALLED_EVENT,
      handleCustomCardGenerationStalled,
      "custom-card stall",
    );

    return removeListener;
  }, [openPrompt]);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let warnedForCurrentDegradation = false;
    let consecutiveSlowSamples = 0;
    let consecutiveSlowResourceTransfers = 0;
    let confirmationTimer: number | undefined;
    let probeInterval: number | undefined;
    let activeProbe: {
      controller: AbortController;
      timedOut: boolean;
      lifecycleCancelled: boolean;
    } | undefined;
    let resourceObserver: PerformanceObserver | undefined;
    let lastProbeFailureKey: string | null = null;
    const listenerCleanups: Array<() => void> = [];

    function runSafely(context: string, callback: () => void) {
      try {
        callback();
      } catch (error) {
        logSlowConnectionMonitorError(context, error);
      }
    }

    function clearTimer(timer: number | undefined, context: string) {
      if (timer === undefined) return;
      try {
        window.clearTimeout(timer);
      } catch (error) {
        logSlowConnectionMonitorError(context, error);
      }
    }

    function clearConfirmationTimer() {
      clearTimer(confirmationTimer, "could not clear confirmation timer");
      confirmationTimer = undefined;
    }

    function resetSlowEvidence() {
      consecutiveSlowSamples = 0;
      consecutiveSlowResourceTransfers = 0;
      warnedForCurrentDegradation = false;
      clearConfirmationTimer();
    }

    function signalSlowConnection() {
      if (
        disposed
        || warnedForCurrentDegradation
        || isOfflineRoute(pathnameRef.current)
        || getOnlineStatus() === false
        || getVisibilityState() === "hidden"
      ) return;

      warnedForCurrentDegradation = true;
      clearConfirmationTimer();
      runSafely("could not open low-connection prompt", openPrompt);
    }

    function scheduleConfirmationProbe() {
      if (confirmationTimer !== undefined || disposed) return;

      try {
        confirmationTimer = window.setTimeout(() => {
          confirmationTimer = undefined;
          runSafely("confirmation probe callback failed", launchProbe);
        }, CONFIRMATION_DELAY_MS);
      } catch (error) {
        logSlowConnectionMonitorError("could not schedule confirmation probe", error);
      }
    }

    function handleEstimateChange() {
      try {
        if (getOnlineStatus() === false || isOfflineRoute(pathnameRef.current)) return;

        // Network Information API values are hints, not proof. They may be stale or
        // inaccurate, so use them only to schedule a confirming reachability sample.
        if (isSlowConnectionEstimate(getNetworkInformation())) scheduleConfirmationProbe();
      } catch (error) {
        logSlowConnectionMonitorError("network estimate handler failed", error);
      }
    }

    function handleOnline() {
      runSafely("online event handler failed", () => {
        resetSlowEvidence();
        handleEstimateChange();
        launchProbe();
      });
    }

    function processReachabilitySample(latencyMs: number, outcome: "success" | "network-error" | "timeout") {
      const isSlow = isSlowReachabilitySample(latencyMs, outcome);
      if (!isSlow) {
        resetSlowEvidence();
        return;
      }

      if (shouldRecommendOfflineMode(latencyMs, outcome, consecutiveSlowSamples)) {
        signalSlowConnection();
        return;
      }

      consecutiveSlowSamples += 1;
      scheduleConfirmationProbe();
    }

    function abortActiveProbe(reason: "lifecycle" | "timeout") {
      const probe = activeProbe;
      if (!probe) return;
      if (reason === "timeout") probe.timedOut = true;
      else probe.lifecycleCancelled = true;

      try {
        probe.controller.abort();
      } catch (error) {
        logSlowConnectionMonitorError(`could not abort ${reason} reachability probe`, error);
      }
    }

    async function probeReachability() {
      if (
        disposed
        || requestInFlight
        || isOpenRef.current
        || isOfflineRoute(pathnameRef.current)
        || getOnlineStatus() === false
        || getVisibilityState() === "hidden"
      ) return;

      requestInFlight = true;
      const startedAt = getMonotonicNow();
      let timeout: number | undefined;
      let probe: NonNullable<typeof activeProbe> | undefined;

      try {
        if (typeof fetch !== "function") {
          logSlowConnectionMonitorWarning("fetch is unavailable; reachability checks are disabled");
          return;
        }
        if (typeof AbortController !== "function") {
          logSlowConnectionMonitorWarning("AbortController is unavailable; reachability checks are disabled");
          return;
        }

        const controller = new AbortController();
        probe = { controller, timedOut: false, lifecycleCancelled: false };
        activeProbe = probe;

        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = window.setTimeout(() => {
            if (!probe) return;
            probe.timedOut = true;
            abortActiveProbe("timeout");
            const error = new Error("Reachability probe timed out");
            error.name = "TimeoutError";
            reject(error);
          }, PROBE_TIMEOUT_MS);
        });

        let response: Response;
        try {
          response = await Promise.race([
            fetch(`/api/offline/reachability?probe=${Date.now()}`, {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
              headers: { "Cache-Control": "no-cache" },
              signal: controller.signal,
            }),
            timeoutPromise,
          ]);
        } catch (error) {
          if (disposed || probe.lifecycleCancelled) return;

          const latencyMs = Math.max(0, getMonotonicNow() - startedAt);
          const outcome = probe.timedOut ? "timeout" : "network-error";
          const failureKey = `${outcome}:${getErrorKey(error)}`;
          if (lastProbeFailureKey !== failureKey) {
            lastProbeFailureKey = failureKey;
            logSlowConnectionMonitorWarning("reachability probe failed", {
              outcome,
              latencyMs,
              error,
            });
          }
          processReachabilitySample(latencyMs, outcome);
          return;
        }

        if (disposed || probe.lifecycleCancelled) return;
        const latencyMs = Math.max(0, getMonotonicNow() - startedAt);
        if (!response || typeof response.ok !== "boolean") {
          throw new TypeError("Reachability endpoint returned an invalid response");
        }

        if (!response.ok) {
          resetSlowEvidence();
          const failureKey = `http:${response.status}`;
          if (lastProbeFailureKey !== failureKey) {
            lastProbeFailureKey = failureKey;
            logSlowConnectionMonitorWarning("reachability endpoint returned a non-success status", {
              status: response.status,
            });
          }
          return;
        }

        lastProbeFailureKey = null;
        processReachabilitySample(latencyMs, "success");
      } catch (error) {
        if (disposed || probe?.lifecycleCancelled) return;
        lastProbeFailureKey = null;
        resetSlowEvidence();
        logSlowConnectionMonitorError("unexpected reachability-monitor error", error);
      } finally {
        clearTimer(timeout, "could not clear reachability timeout");
        if (activeProbe === probe) activeProbe = undefined;
        requestInFlight = false;
      }
    }

    function launchProbe() {
      try {
        void probeReachability().catch((error: unknown) => {
          logSlowConnectionMonitorError("reachability probe escaped its internal handler", error);
        });
      } catch (error) {
        logSlowConnectionMonitorError("could not start reachability probe", error);
      }
    }

    function inspectResourceEntries(entries: PerformanceEntry[]) {
      try {
        if (
          disposed
          || isOfflineRoute(pathnameRef.current)
          || getOnlineStatus() === false
          || isOpenRef.current
        ) return;

        const now = getMonotonicNow();
        for (const entry of entries) {
          try {
            if (entry.entryType !== "resource" || now - entry.startTime > RECENT_RESOURCE_WINDOW_MS) continue;

            const resource = entry as PerformanceResourceTiming;
            const entryKey = `${resource.name}:${resource.startTime}:${resource.responseEnd}`;
            if (seenResourceEntriesRef.current.has(entryKey)) continue;

            let resourceUrl: URL;
            try {
              resourceUrl = new URL(resource.name, window.location.href);
            } catch {
              continue;
            }

            if (
              resourceUrl.origin === window.location.origin
              && resourceUrl.pathname === "/api/offline/reachability"
            ) continue;

            seenResourceEntriesRef.current.add(entryKey);
            if (seenResourceEntriesRef.current.size > MAX_SEEN_RESOURCE_ENTRIES) {
              const oldestEntry = seenResourceEntriesRef.current.values().next().value;
              if (oldestEntry) seenResourceEntriesRef.current.delete(oldestEntry);
            }

            const transfer = estimateResourceTransfer({
              transferSizeBytes: resource.transferSize,
              encodedBodySizeBytes: resource.encodedBodySize,
              responseStartMs: resource.responseStart,
              responseEndMs: resource.responseEnd,
            });
            if (!transfer || transfer.bytesTransferred < MIN_RESOURCE_TRANSFER_BYTES) continue;

            if (transfer.throughputMbps <= SLOW_RESOURCE_THROUGHPUT_MBPS) {
              consecutiveSlowResourceTransfers += 1;
              if (
                transfer.durationMs >= VERY_SLOW_CONNECTION_LATENCY_MS
                || consecutiveSlowResourceTransfers >= 2
              ) {
                signalSlowConnection();
                return;
              }
            } else {
              consecutiveSlowResourceTransfers = 0;
              warnedForCurrentDegradation = false;
            }
          } catch (error) {
            logSlowConnectionMonitorError("ignored malformed resource timing entry", error);
          }
        }
      } catch (error) {
        logSlowConnectionMonitorError("resource timing inspection failed", error);
      }
    }

    function handleVisibilityChange() {
      runSafely("visibility-change handler failed", () => {
        if (getVisibilityState() !== "visible") {
          clearConfirmationTimer();
          abortActiveProbe("lifecycle");
          return;
        }

        handleEstimateChange();
        launchProbe();
      });
    }

    function handleOffline() {
      runSafely("offline event handler failed", () => {
        resetSlowEvidence();
        abortActiveProbe("lifecycle");
      });
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      clearConfirmationTimer();
      abortActiveProbe("lifecycle");

      if (probeInterval !== undefined) {
        try {
          window.clearInterval(probeInterval);
        } catch (error) {
          logSlowConnectionMonitorError("could not clear reachability interval", error);
        }
        probeInterval = undefined;
      }

      for (const removeListener of listenerCleanups.splice(0)) removeListener();

      try {
        resourceObserver?.disconnect();
      } catch (error) {
        logSlowConnectionMonitorError("could not disconnect resource timing observer", error);
      }

      if (launchProbeRef.current === launchProbe) launchProbeRef.current = null;
      if (cancelProbeRef.current === cancelProbe) cancelProbeRef.current = null;
    }

    function cancelProbe() {
      clearConfirmationTimer();
      abortActiveProbe("lifecycle");
      consecutiveSlowSamples = 0;
      consecutiveSlowResourceTransfers = 0;
    }

    let visualTest = false;
    try {
      const currentUrl = new URL(window.location.href);
      visualTest = process.env.NODE_ENV !== "production"
        && currentUrl.searchParams.get("visual") === "slow-connection";
    } catch (error) {
      logSlowConnectionMonitorError("could not inspect visual-test URL", error);
    }
    isVisualTestRef.current = visualTest;

    if (visualTest) {
      runSafely("visual-test prompt failed", openPrompt);
      return cleanup;
    }

    launchProbeRef.current = launchProbe;
    cancelProbeRef.current = cancelProbe;

    const networkInformation = getNetworkInformation();
    if (networkInformation) {
      listenerCleanups.push(addMonitorEventListener(
        networkInformation,
        "change",
        handleEstimateChange,
        "network estimate",
      ));
    }
    listenerCleanups.push(addMonitorEventListener(window, "online", handleOnline, "online"));
    listenerCleanups.push(addMonitorEventListener(window, "offline", handleOffline, "offline"));
    listenerCleanups.push(addMonitorEventListener(document, "visibilitychange", handleVisibilityChange, "visibility"));

    try {
      if (typeof PerformanceObserver !== "undefined") {
        resourceObserver = new PerformanceObserver((list) => {
          runSafely("resource observer callback failed", () => inspectResourceEntries(list.getEntries()));
        });
        resourceObserver.observe({ type: "resource", buffered: true });
      }
    } catch (error) {
      resourceObserver = undefined;
      logSlowConnectionMonitorWarning("resource timing observer is unavailable", error);
    }

    try {
      if (typeof performance.getEntriesByType === "function") {
        inspectResourceEntries(performance.getEntriesByType("resource"));
      }
    } catch (error) {
      logSlowConnectionMonitorError("could not read initial resource timings", error);
    }

    if (!isOfflineRoute(pathnameRef.current)) {
      runSafely("initial network estimate failed", handleEstimateChange);
      launchProbe();
    }

    try {
      probeInterval = window.setInterval(() => {
        runSafely("periodic reachability callback failed", launchProbe);
      }, PROBE_INTERVAL_MS);
    } catch (error) {
      logSlowConnectionMonitorError("could not start reachability interval", error);
    }

    return cleanup;
  }, [openPrompt]);

  useEffect(() => {
    if (!isOpen) return;

    let previouslyFocused: HTMLElement | null = null;
    let focusFrame: number | undefined;
    let cancelFocusFrame: ((handle: number) => void) | undefined;

    try {
      previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      const focusFirstAction = () => {
        try {
          offlineButtonRef.current?.focus();
        } catch (error) {
          logSlowConnectionMonitorError("could not focus the offline action", error);
        }
      };

      if (typeof window.requestAnimationFrame === "function") {
        focusFrame = window.requestAnimationFrame(focusFirstAction);
        cancelFocusFrame = (handle) => window.cancelAnimationFrame(handle);
      } else {
        focusFrame = window.setTimeout(focusFirstAction, 0);
        cancelFocusFrame = (handle) => window.clearTimeout(handle);
      }
    } catch (error) {
      logSlowConnectionMonitorError("could not initialize prompt focus handling", error);
    }

    return () => {
      try {
        if (focusFrame !== undefined) cancelFocusFrame?.(focusFrame);
      } catch (error) {
        logSlowConnectionMonitorError("could not cancel prompt focus handling", error);
      }

      try {
        if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
      } catch (error) {
        logSlowConnectionMonitorError("could not restore focus after closing prompt", error);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleDialogKeyboard(event: KeyboardEvent) {
      try {
        if (event.key === "Escape") {
          event.preventDefault();
          dismissPrompt();
          return;
        }

        if (event.key !== "Tab") return;
        const firstButton = offlineButtonRef.current;
        const lastButton = continueButtonRef.current;
        if (!firstButton || !lastButton) return;

        if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      } catch (error) {
        logSlowConnectionMonitorError("prompt keyboard handler failed", error);
      }
    }

    return addMonitorEventListener(
      document,
      "keydown",
      handleDialogKeyboard as EventListener,
      "prompt keyboard",
    );
  }, [dismissPrompt, isOpen]);

  function enterOfflineMode() {
    try {
      dismissPrompt();

      const currentUrl = new URL(window.location.href);
      const returnUrl = new URL(currentUrl.href);
      if (
        process.env.NODE_ENV !== "production"
        && returnUrl.searchParams.get("visual") === "slow-connection"
      ) {
        returnUrl.searchParams.delete("visual");
      }

      const returnTo = `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
      const isNativeApp = currentUrl.searchParams.get("native") === "1"
        || currentUrl.searchParams.get("twa") === "1";
      const offlineUrl = new URL(isNativeApp ? "/~offline" : "/offline", currentUrl.origin);
      offlineUrl.searchParams.set("returnTo", returnTo);

      if (isNativeApp) {
        window.location.assign(offlineUrl.toString());
        return;
      }

      router.push(`${offlineUrl.pathname}${offlineUrl.search}`);
    } catch (error) {
      logSlowConnectionMonitorError("could not navigate to offline mode", error);
    }
  }

  if (!isOpen) return null;

  const useSuperWater = canUseSuperWater(locale);
  const panelForeground = getAccessibleForeground(theme.brand);
  const displayText = (value: string) => useSuperWater
    ? formatSuperWaterText(locale, value)
    : value;

  return createPortal(
    <div
      className="slow-connection-prompt-overlay fixed inset-0 z-[2147483000] grid min-h-[100dvh] place-items-center overflow-y-auto bg-black/75 px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-slow-connection-prompt="true"
      onClick={(event) => event.stopPropagation()}
    >
      <section
        aria-describedby="slow-connection-description"
        aria-labelledby="slow-connection-title"
        aria-modal="true"
        className="slow-connection-prompt-panel w-full max-w-[26rem] rounded-[28px] bg-brand px-6 py-7 text-center shadow-lg sm:px-8 sm:py-8"
        role="alertdialog"
        style={{ color: panelForeground }}
      >
        <Wifi aria-hidden="true" className="slow-connection-prompt-icon mx-auto size-10 text-white" strokeWidth={2.4} />
        <h2
          className={cn(
            "slow-connection-prompt-title mt-4 text-2xl font-bold leading-tight text-white sm:text-[1.75rem]",
            useSuperWater && "font-super-water",
          )}
          id="slow-connection-title"
        >
          {displayText(t("network.slow.title"))}
        </h2>
        <p
          className={cn(
            "slow-connection-prompt-description mx-auto mt-3 max-w-sm text-center text-base font-semibold leading-6 text-white",
            useSuperWater && "font-super-water",
          )}
          id="slow-connection-description"
        >
          {displayText(t("network.slow.description"))}
        </p>

        <div className="slow-connection-prompt-actions mt-7 grid gap-3">
          <button
            className={cn(
              "slow-connection-prompt-button min-h-14 w-full rounded-full bg-white px-5 py-3 text-center text-base font-bold text-[#111827] outline-none transition-[filter,transform] duration-150 active:scale-[0.99] active:brightness-95 focus-visible:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111827]",
              useSuperWater && "font-super-water",
            )}
            onClick={enterOfflineMode}
            ref={offlineButtonRef}
            type="button"
          >
            {displayText(t("network.slow.offline"))}
          </button>
          <button
            className={cn(
              "slow-connection-prompt-button min-h-14 w-full rounded-full bg-black px-5 py-3 text-center text-base font-bold text-white outline-none transition-[filter,transform] duration-150 active:scale-[0.99] active:brightness-110 focus-visible:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
              useSuperWater && "font-super-water",
            )}
            onClick={dismissPrompt}
            ref={continueButtonRef}
            type="button"
          >
            {displayText(t("network.slow.continue"))}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
