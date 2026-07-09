"use client";

import { getTwaMode } from "@/features/install-app/twa-mode";

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
  return getTwaMode();
}

export interface TwaAnalyticsOptions {
  once?: boolean;
  params?: Record<string, string | number | boolean>;
}

function navigateTwaUrl(url: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Use location.replace so the custom-scheme navigation does not add a
    // history entry. The Android side intercepts foxiesdeck://event URLs in
    // EventReceiverActivity and does not leave the TWA web page.
    window.location.replace(url);
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
