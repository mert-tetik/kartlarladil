"use client";

import { useAuthSession } from "@/features/auth/auth-client";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";

export function LeaderboardDataPreloader() {
  const { user } = useAuthSession();
  useLeaderboardData({
    enabled: Boolean(user),
    mode: "points",
    refreshOnMount: true,
  });

  return null;
}
