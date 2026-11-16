"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { getTwaMode } from "@/features/install-app/twa-mode";

const SESSION_TRACKED_PREFIX = "foxiesdeck:analytics-session:";

function readAttribution(): Record<string, string> {
  const searchParams = new URLSearchParams(window.location.search);
  const properties: Record<string, string> = {};

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid"] as const) {
    const value = searchParams.get(key)?.trim();
    if (value) properties[key] = value.slice(0, 200);
  }

  return properties;
}

export function AnalyticsSessionTracker() {
  const { user, isSessionReady } = useAuthSession();

  useEffect(() => {
    if (!isSessionReady || !user) return;

    const sessionKey = `${SESSION_TRACKED_PREFIX}${user.id}`;
    try {
      if (window.sessionStorage.getItem(sessionKey) === "1") return;
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      // Continue without deduplication if storage is unavailable.
    }

    trackAnalyticsEvent("app_opened", {
      platform: getTwaMode() ? "twa" : "web",
      ...readAttribution(),
    });
  }, [isSessionReady, user]);

  return null;
}
