"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";

let leaderboardCache: LeaderboardPayload | null = null;

export function useLeaderboardData({
  enabled = true,
  refreshOnMount = false,
}: {
  enabled?: boolean;
  refreshOnMount?: boolean;
} = {}) {
  const [data, setData] = useState<LeaderboardPayload | null>(leaderboardCache);
  const [loading, setLoading] = useState(enabled && !leaderboardCache);
  const [error, setError] = useState("");

  const fetchLeaderboard = useCallback(async ({ showLoading }: { showLoading: boolean }) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");

    try {
      const response = await fetch("/api/leaderboard", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`leaderboard_${response.status}`);
      }

      const payload = (await response.json()) as LeaderboardPayload;
      leaderboardCache = payload;
      setData(payload);
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchLeaderboard({ showLoading: true });
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError("");
      return;
    }

    if (!refreshOnMount && leaderboardCache) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchLeaderboard({ showLoading: refreshOnMount ? !leaderboardCache : true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled, fetchLeaderboard, refreshOnMount]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
