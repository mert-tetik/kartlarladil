"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Wifi } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
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

function getNetworkInformation() {
  const browserNavigator = navigator as NavigatorWithNetworkInformation;
  return browserNavigator.connection ?? browserNavigator.mozConnection ?? browserNavigator.webkitConnection;
}

function isOfflineRoute(pathname: string) {
  return pathname === "/offline"
    || pathname === "/~offline"
    || pathname === "/visual-test-offline";
}

export function SlowConnectionMonitor() {
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

  const openPrompt = useCallback(() => {
    if (isOpenRef.current) return;

    if (!isVisualTestRef.current) {
      try {
        const dismissedUntil = Number(window.sessionStorage.getItem(PROMPT_DISMISSAL_KEY));
        if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;
      } catch {
        // Storage can be disabled; the in-memory guard still prevents prompt spam.
      }
    }

    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  const dismissPrompt = useCallback(() => {
    if (!isVisualTestRef.current) {
      try {
        window.sessionStorage.setItem(
          PROMPT_DISMISSAL_KEY,
          String(Date.now() + PROMPT_COOLDOWN_MS),
        );
      } catch {
        // The in-memory dismissal still lasts until this app shell is reloaded.
      }
    }

    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOfflineRoute(pathname)) return;

    function handleCustomCardGenerationStalled() {
      if (navigator.onLine) openPrompt();
    }

    window.addEventListener(CUSTOM_CARD_GENERATION_STALLED_EVENT, handleCustomCardGenerationStalled);
    return () => window.removeEventListener(CUSTOM_CARD_GENERATION_STALLED_EVENT, handleCustomCardGenerationStalled);
  }, [openPrompt, pathname]);

  useEffect(() => {
    if (isOfflineRoute(pathname)) return;

    const currentUrl = new URL(window.location.href);
    const visualTest = process.env.NODE_ENV !== "production"
      && currentUrl.searchParams.get("visual") === "slow-connection";
    isVisualTestRef.current = visualTest;

    if (visualTest) {
      openPrompt();
      return;
    }

    let disposed = false;
    let requestInFlight = false;
    let warnedForCurrentDegradation = false;
    let consecutiveSlowSamples = 0;
    let consecutiveSlowResourceTransfers = 0;
    let confirmationTimer: number | undefined;

    function clearConfirmationTimer() {
      if (confirmationTimer !== undefined) {
        window.clearTimeout(confirmationTimer);
        confirmationTimer = undefined;
      }
    }

    function signalSlowConnection() {
      if (disposed || warnedForCurrentDegradation) return;
      warnedForCurrentDegradation = true;
      clearConfirmationTimer();
      openPrompt();
    }

    function scheduleConfirmationProbe() {
      if (confirmationTimer !== undefined || disposed) return;
      confirmationTimer = window.setTimeout(() => {
        confirmationTimer = undefined;
        void probeReachability();
      }, CONFIRMATION_DELAY_MS);
    }

    function handleEstimateChange() {
      if (!navigator.onLine) return;
      if (isSlowConnectionEstimate(getNetworkInformation())) {
        signalSlowConnection();
      }
    }

    function handleOnline() {
      handleEstimateChange();
      void probeReachability();
    }

    async function probeReachability() {
      if (
        disposed
        || requestInFlight
        || isOpenRef.current
        || !navigator.onLine
        || document.visibilityState !== "visible"
      ) return;

      requestInFlight = true;
      const startedAt = performance.now();
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

      try {
        const response = await fetch(`/api/offline/reachability?probe=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" },
          signal: controller.signal,
        });
        const latencyMs = performance.now() - startedAt;
        if (!response.ok) {
          consecutiveSlowSamples = 0;
          warnedForCurrentDegradation = false;
          clearConfirmationTimer();
          return;
        }

        const isSlow = isSlowReachabilitySample(latencyMs, "success");

        if (!isSlow) {
          consecutiveSlowSamples = 0;
          warnedForCurrentDegradation = false;
          clearConfirmationTimer();
          return;
        }

        if (shouldRecommendOfflineMode(latencyMs, "success", consecutiveSlowSamples)) {
          signalSlowConnection();
          return;
        }

        consecutiveSlowSamples += 1;
        scheduleConfirmationProbe();
      } catch {
        const latencyMs = performance.now() - startedAt;
        if (disposed || !navigator.onLine) return;

        if (shouldRecommendOfflineMode(latencyMs, "network-error", consecutiveSlowSamples)) {
          signalSlowConnection();
          return;
        }

        consecutiveSlowSamples += 1;
        scheduleConfirmationProbe();
      } finally {
        window.clearTimeout(timeout);
        requestInFlight = false;
      }
    }

    function inspectResourceEntries(entries: PerformanceEntry[]) {
      if (disposed || !navigator.onLine || isOpenRef.current) return;

      const now = performance.now();
      for (const entry of entries) {
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
        if (!transfer || transfer.durationMs <= 0 || transfer.bytesTransferred < MIN_RESOURCE_TRANSFER_BYTES) {
          continue;
        }

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
      }
    }

    let resourceObserver: PerformanceObserver | undefined;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        resourceObserver = new PerformanceObserver((list) => {
          inspectResourceEntries(list.getEntries());
        });
        resourceObserver.observe({ type: "resource", buffered: true });
      } catch {
        resourceObserver = undefined;
      }
    }
    inspectResourceEntries(performance.getEntriesByType("resource"));

    const networkInformation = getNetworkInformation();
    networkInformation?.addEventListener("change", handleEstimateChange);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      handleEstimateChange();
      void probeReachability();
    }

    handleEstimateChange();
    void probeReachability();
    const probeInterval = window.setInterval(() => {
      void probeReachability();
    }, PROBE_INTERVAL_MS);

    return () => {
      disposed = true;
      clearConfirmationTimer();
      window.clearInterval(probeInterval);
      networkInformation?.removeEventListener("change", handleEstimateChange);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resourceObserver?.disconnect();
    };
  }, [openPrompt, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFirstAction = () => offlineButtonRef.current?.focus();
    const focusFrame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(focusFirstAction)
      : window.setTimeout(focusFirstAction, 0);
    const cancelFocusFrame = typeof window.requestAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : window.clearTimeout.bind(window);

    return () => {
      cancelFocusFrame(focusFrame);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleDialogKeyboard(event: KeyboardEvent) {
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
    }

    document.addEventListener("keydown", handleDialogKeyboard);
    return () => document.removeEventListener("keydown", handleDialogKeyboard);
  }, [dismissPrompt, isOpen]);

  function enterOfflineMode() {
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
