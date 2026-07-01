"use client";

const TWA_ANALYTICS_SENT_KEY = "foxiesdeck:twa-analytics-sent";
const TWA_REFERRER = "android-app://com.LigidTools.Glidecore";

function getSentSet(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(TWA_ANALYTICS_SENT_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSent(eventName: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const sent = getSentSet();
    sent.add(eventName);
    window.localStorage.setItem(TWA_ANALYTICS_SENT_KEY, JSON.stringify([...sent]));
  } catch {
    // ignore
  }
}

export function isTwaMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const referrer = document.referrer ?? "";

  // The most reliable TWA signal is the android-app referrer sent by Chrome
  // when launching a Trusted Web Activity.
  if (referrer.includes(TWA_REFERRER)) {
    return true;
  }

  // Fallback: standalone display mode can indicate a PWA/TWA install.
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }

  return false;
}

export interface TwaAnalyticsOptions {
  once?: boolean;
  params?: Record<string, string | number | boolean>;
}

export function sendTwaAnalyticsEvent(
  eventName: string,
  options: TwaAnalyticsOptions = {},
): void {
  if (!isTwaMode()) {
    return;
  }

  if (options.once && getSentSet().has(eventName)) {
    return;
  }

  try {
    const searchParams = new URLSearchParams();
    searchParams.set("type", eventName);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
    }

    const url = `foxiesdeck://event?${searchParams.toString()}`;

    // Try a hidden iframe first so the TWA web page does not navigate away.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.src = url;

    document.body.appendChild(iframe);

    // Fallback to a direct navigation if the iframe approach did not trigger
    // the intent within a short window (e.g. blocked by Chrome Custom Tab).
    const fallbackTimer = window.setTimeout(() => {
      iframe.remove();
      try {
        window.location.href = url;
      } catch {
        // ignore
      }
    }, 300);

    iframe.onload = () => {
      window.clearTimeout(fallbackTimer);
      window.setTimeout(() => iframe.remove(), 1000);
    };

    iframe.onerror = () => {
      window.clearTimeout(fallbackTimer);
      iframe.remove();
    };

    if (options.once) {
      markSent(eventName);
    }
  } catch {
    // ignore
  }
}
