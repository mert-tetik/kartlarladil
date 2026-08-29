"use client";

import { useSearchParams } from "next/navigation";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";

export const LEADERBOARD_CONSENT_TEST_PARAM = "leaderboard-consent-test";

export function isLeaderboardConsentTestMode(
  searchParams: Pick<URLSearchParams, "get">,
) {
  const value = searchParams.get(LEADERBOARD_CONSENT_TEST_PARAM);
  return value === "1" || value === "true";
}

export function useLeaderboardConsentTestMode() {
  const searchParams = useSearchParams();
  return isLeaderboardConsentTestMode(searchParams);
}

export function applyLeaderboardConsentTestMode(
  payload: LeaderboardPayload | null,
  enabled: boolean,
) {
  if (!payload || !enabled) {
    return payload;
  }

  return {
    ...payload,
    viewer: {
      ...payload.viewer,
      leaderboardVisible: false,
    },
    entries: [],
    canViewLeaderboard: false,
  };
}
