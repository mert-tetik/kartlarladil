"use client";

export type AnalyticsEventName =
  | "tutorial_completed"
  | "onboarding_completed"
  | "app_opened"
  | "first_card_added"
  | "first_quiz_completed"
  | "first_card_learned"
  | "learn_session_completed"
  | "pricing_page_viewed"
  | "pricing_subscription_details_opened"
  | "subscription_restriction_opened"
  | "subscription_restriction_details_opened"
  | "subscription_purchase_started"
  | "subscription_purchase_succeeded"
  | "subscription_purchase_failed"
  | "subscription_purchase_cancelled"
  | "subscription_restored"
  | "subscription_restore_failed"
  | "account_deleted";

export type AnalyticsEventProperties = Readonly<Record<string, string | number | boolean>>;

export type AnalyticsPurchaseSource = "pricing" | "restriction" | "serious_learner";

export interface TrackAnalyticsEventOptions {
  /** Best-effort client-side deduplication for user milestones. */
  once?: boolean;
  dedupeKey?: string;
}

const ANALYTICS_ENDPOINT = "/api/analytics/events";
const ANALYTICS_SENT_KEY = "foxiesdeck:analytics-events-sent";

function readSentEvents(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(ANALYTICS_SENT_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markEventSent(key: string) {
  try {
    const sent = readSentEvents();
    sent.add(key);
    window.localStorage.setItem(ANALYTICS_SENT_KEY, JSON.stringify([...sent]));
  } catch {
    // Storage is only a deduplication aid; analytics remains best-effort.
  }
}

/**
 * Best-effort product analytics. The caller never waits for the request and
 * analytics failures are intentionally invisible to the user.
 */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
  options: TrackAnalyticsEventOptions = {},
) {
  if (typeof window === "undefined") return;

  const dedupeKey = options.dedupeKey ? `${eventName}:${options.dedupeKey}` : eventName;
  if (options.once && readSentEvents().has(dedupeKey)) return;

  const payload = JSON.stringify({
    event_name: eventName,
    ...(properties ? { properties } : {}),
  });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );

      if (accepted) {
        if (options.once) markEventSent(dedupeKey);
        return;
      }
    }
  } catch {
    // Fall back to keepalive fetch below. Analytics must never affect UX.
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);

  if (options.once) markEventSent(dedupeKey);
}
