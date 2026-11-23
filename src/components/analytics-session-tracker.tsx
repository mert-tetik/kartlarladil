"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { getTwaMode } from "@/features/install-app/twa-mode";

const SESSION_TRACKED_PREFIX = "foxiesdeck:analytics-session:";
const SESSION_ANALYTICS_ENDPOINT = "/api/analytics/sessions";
export const ANALYTICS_SESSION_HEARTBEAT_INTERVAL_MS = 15_000;

type SessionAction = "start" | "heartbeat" | "end";
type SessionEndReason = "pagehide" | "logout" | "native_pause" | "timeout" | "unknown";

function createSessionId() {
  if (typeof window !== "undefined" && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sendSessionRequest(
  payload: { action: SessionAction; session_id: string; platform: "web" | "twa"; end_reason?: SessionEndReason },
  keepalive = false,
) {
  const body = JSON.stringify(payload);

  if (keepalive && typeof navigator.sendBeacon === "function") {
    try {
      if (navigator.sendBeacon(
        SESSION_ANALYTICS_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      )) return;
    } catch {
      // Fall through to keepalive fetch. Analytics must never affect UX.
    }
  }

  void fetch(SESSION_ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "same-origin",
    ...(keepalive ? { keepalive: true } : {}),
  }).catch(() => undefined);
}

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
  const userId = user?.id;

  useEffect(() => {
    if (!isSessionReady || !userId) return;

    const sessionId = createSessionId();
    const platform = getTwaMode() ? "twa" : "web";
    let sessionEnded = false;

    sendSessionRequest({ action: "start", session_id: sessionId, platform });

    const sessionKey = `${SESSION_TRACKED_PREFIX}${userId}`;
    let shouldTrackAppOpen = true;
    try {
      if (window.sessionStorage.getItem(sessionKey) === "1") {
        shouldTrackAppOpen = false;
      } else {
        window.sessionStorage.setItem(sessionKey, "1");
      }
    } catch {
      // Continue without deduplication if storage is unavailable.
    }

    if (shouldTrackAppOpen) {
      trackAnalyticsEvent("app_opened", {
        platform,
        ...readAttribution(),
      });
    }

    const sendHeartbeat = (keepalive = false) => {
      if (sessionEnded) return;
      sendSessionRequest({ action: "heartbeat", session_id: sessionId, platform }, keepalive);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") sendHeartbeat();
    }, ANALYTICS_SESSION_HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      // Capture the transition immediately; browsers may throttle the timer
      // while the WebView is hidden. The session remains open for resume.
      sendHeartbeat(document.visibilityState !== "visible");
    };

    const handlePageHide = () => {
      if (sessionEnded) return;
      sessionEnded = true;
      sendSessionRequest({
        action: "end",
        session_id: sessionId,
        platform,
        end_reason: "pagehide",
      }, true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isSessionReady, userId]);

  return null;
}
