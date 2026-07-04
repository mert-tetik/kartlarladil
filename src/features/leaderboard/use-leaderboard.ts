"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";

let leaderboardCache: LeaderboardPayload | null = null;

export function useLeaderboardData() {
  const [data, setData] = useState<LeaderboardPayload | null>(leaderboardCache);
  const [loading, setLoading] = useState(!leaderboardCache);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    if (!leaderboardCache) {
      void refresh();
    }
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
