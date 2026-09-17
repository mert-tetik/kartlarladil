"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LeaderboardMode,
  LeaderboardPayload,
} from "@/features/leaderboard/leaderboard-types";
import {
  applyLeaderboardConsentTestMode,
  useLeaderboardConsentTestMode,
} from "@/features/leaderboard/leaderboard-consent-test-mode";
import { LEADERBOARD_REFRESH_EVENT } from "@/features/leaderboard/leaderboard-refresh";

const leaderboardCache = new Map<LeaderboardMode, LeaderboardPayload>();

export function useLeaderboardData({
  enabled = true,
  refreshOnMount = false,
  mode = "points",
}: {
  enabled?: boolean;
  refreshOnMount?: boolean;
  mode?: LeaderboardMode;
} = {}) {
  const leaderboardConsentTestMode = useLeaderboardConsentTestMode();
  const [data, setData] = useState<LeaderboardPayload | null>(() => leaderboardCache.get(mode) ?? null);
  const [loading, setLoading] = useState(enabled && !leaderboardCache.has(mode));
  const [error, setError] = useState("");

  const fetchLeaderboard = useCallback(async ({ showLoading }: { showLoading: boolean }) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");

    try {
      const response = await fetch(
        mode === "points" ? "/api/leaderboard" : `/api/leaderboard?mode=${mode}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`leaderboard_${response.status}`);
      }

      const payload = (await response.json()) as LeaderboardPayload;
      const normalizedPayload = { ...payload, mode: payload.mode ?? mode };
      leaderboardCache.set(mode, normalizedPayload);
      setData(normalizedPayload);
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const refresh = useCallback(async () => {
    await fetchLeaderboard({ showLoading: true });
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError("");
      return;
    }

    const cachedPayload = leaderboardCache.get(mode) ?? null;
    setData(cachedPayload);
    setLoading(!cachedPayload);

    if (!refreshOnMount && cachedPayload) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchLeaderboard({ showLoading: refreshOnMount ? !cachedPayload : true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled, fetchLeaderboard, mode, refreshOnMount]);

  useEffect(() => {
    function refreshAfterPointsChange() {
      leaderboardCache.delete(mode);
      void fetchLeaderboard({ showLoading: false });
    }

    window.addEventListener(LEADERBOARD_REFRESH_EVENT, refreshAfterPointsChange);

    return () => {
      window.removeEventListener(LEADERBOARD_REFRESH_EVENT, refreshAfterPointsChange);
    };
  }, [fetchLeaderboard, mode]);

  const displayedData = useMemo(
    () => applyLeaderboardConsentTestMode(data, leaderboardConsentTestMode),
    [data, leaderboardConsentTestMode],
  );

  return {
    data: displayedData,
    loading,
    error,
    refresh,
  };
}
