"use client";

const TWA_ANALYTICS_SENT_KEY = "foxiesdeck:twa-analytics-sent";

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

  const ua = window.navigator.userAgent;
  const referrer = document.referrer;

  return (
    window.navigator.standalone === true ||
    referrer.includes("android-app://com.LigidTools.Glidecore") ||
    referrer.includes("android-app://") ||
    /Android.*Chrome/.test(ua)
  );
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

    // Use a hidden iframe so the TWA web page does not navigate away.
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

    window.setTimeout(() => {
      iframe.remove();
    }, 1000);

    if (options.once) {
      markSent(eventName);
    }
  } catch {
    // ignore
  }
}
