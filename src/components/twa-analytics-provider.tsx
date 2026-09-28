"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isTwaMode, sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { isMissionVisualTestRoute } from "@/lib/visual-test-mode";

const ENGAGEMENT_PULSE_INTERVAL_MS = 30000;

export function TwaAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasLoggedInitialScreenRef = useRef(false);

  useEffect(() => {
    if (isMissionVisualTestRoute(pathname) || !isTwaMode()) {
      return;
    }

    sendTwaAnalyticsEvent("fd_app_open");

    const interval = window.setInterval(() => {
      sendTwaAnalyticsEvent("fd_engagement_pulse");
    }, ENGAGEMENT_PULSE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    if (isMissionVisualTestRoute(pathname) || !isTwaMode()) {
      return;
    }

    if (!hasLoggedInitialScreenRef.current) {
      hasLoggedInitialScreenRef.current = true;
      return;
    }

    const screenName = pathname.slice(0, 100);
    sendTwaAnalyticsEvent("fd_screen_view", {
      params: { screen_name: screenName },
    });
  }, [pathname]);

  return children;
}
