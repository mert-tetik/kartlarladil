"use client";

import { getTwaMode } from "@/features/install-app/twa-mode";

const TWA_ANALYTICS_SENT_KEY = "foxiesdeck:twa-analytics-sent";
const TWA_REGISTRATION_EVENT_KEY = "foxiesdeck:twa-registration-event";
const TWA_QUALITY_ACTIVATION_SIGNALS_KEY = "foxiesdeck:twa-quality-activation-signals";
const REGISTRATION_DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000;

const QUALITY_ACTIVATION_SIGNALS = [
  "tutorial_completed",
  "first_card_added",
  "first_quiz_completed",
] as const;

export type TwaQualityActivationSignal = (typeof QUALITY_ACTIVATION_SIGNALS)[number];

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
  return getTwaMode();
}

export interface TwaAnalyticsOptions {
  once?: boolean;
  params?: Record<string, string | number | boolean>;
}

export function sendTwaSubscriptionPurchaseEvent(
  sku: string,
  price?: { value?: string; currency?: string } | null,
): void {
  const plan = sku.startsWith("basic_") ? "basic" : sku.startsWith("pro_") ? "pro" : "";
  const billingCycle = sku.endsWith("_monthly")
    ? "monthly"
    : sku.endsWith("_yearly")
      ? "yearly"
      : "";

  sendTwaAnalyticsEvent("fd_subscription_purchase", {
    params: {
      plan,
      billing_cycle: billingCycle,
      sku,
      value: price?.value ?? "",
      currency: price?.currency ?? "",
    },
  });
}

function navigateTwaUrl(url: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.display = "none";
    iframe.src = url;

    document.body.appendChild(iframe);

    window.setTimeout(() => {
      iframe.remove();
    }, 1000);
  } catch {
    // ignore
  }
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

  const searchParams = new URLSearchParams();
  searchParams.set("type", eventName);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
  }

  navigateTwaUrl(`foxiesdeck://event?${searchParams.toString()}`);

  if (options.once) {
    markSent(eventName);
  }
}

/**
 * Records the three actions that define a meaningful first activation in the
 * TWA. The bridge emits one deduplicated event only after all three signals
 * are present, so ad platforms optimize for users who actually use the app.
 */
export function trackTwaQualityActivation(signal: TwaQualityActivationSignal): void {
  if (!isTwaMode() || typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(TWA_QUALITY_ACTIVATION_SIGNALS_KEY);
    const signals = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    signals.add(signal);
    window.localStorage.setItem(
      TWA_QUALITY_ACTIVATION_SIGNALS_KEY,
      JSON.stringify([...signals]),
    );

    if (!QUALITY_ACTIVATION_SIGNALS.every((requiredSignal) => signals.has(requiredSignal))) {
      return;
    }
  } catch {
    return;
  }

  sendTwaAnalyticsEvent("fd_quality_activation", {
    once: true,
    params: { activation_type: "tutorial_card_quiz" },
  });
}

/** Send registration once across the form-success and auth-session paths. */
export function sendTwaRegistrationEvent(
  registrationMethod: string,
  accountKey?: string,
): void {
  if (!isTwaMode()) {
    return;
  }

  const now = Date.now();
  const accountMarker = accountKey ? `${TWA_REGISTRATION_EVENT_KEY}:${accountKey}` : null;

  try {
    const anonymousTimestamp = Number.parseInt(
      window.localStorage.getItem(TWA_REGISTRATION_EVENT_KEY) ?? "",
      10,
    );
    const accountWasRecentlyTracked = accountMarker
      ? window.localStorage.getItem(accountMarker) !== null
      : false;

    if (
      accountWasRecentlyTracked ||
      (!accountKey && Number.isFinite(anonymousTimestamp) && now - anonymousTimestamp < REGISTRATION_DEDUPLICATION_WINDOW_MS) ||
      (accountKey && Number.isFinite(anonymousTimestamp) && now - anonymousTimestamp < REGISTRATION_DEDUPLICATION_WINDOW_MS)
    ) {
      return;
    }

    window.localStorage.setItem(TWA_REGISTRATION_EVENT_KEY, String(now));
    if (accountMarker) {
      window.localStorage.setItem(accountMarker, String(now));
    }
  } catch {
    // Storage is only a deduplication aid; the event remains best-effort.
  }

  sendTwaAnalyticsEvent("fd_registration_completed", {
    params: { registration_method: registrationMethod },
  });
}

export function requestGooglePlayReview(): void {
  if (!isTwaMode()) {
    return;
  }

  navigateTwaUrl("foxiesdeck://event?type=request_play_review");
}

export function setTwaAnalyticsUserId(userId: string | null): void {
  if (!isTwaMode()) {
    return;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("type", "set_user_id");
  if (userId) {
    searchParams.set("user_id", userId);
  }

  navigateTwaUrl(`foxiesdeck://event?${searchParams.toString()}`);
}
