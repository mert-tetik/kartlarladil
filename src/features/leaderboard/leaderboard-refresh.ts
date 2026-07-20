export const LEADERBOARD_REFRESH_EVENT = "foxiesdeck:leaderboard-refresh";

// Reward flows call this only after their persistent point update succeeds.
// Every mounted leaderboard consumer then refreshes from the authoritative score data.
export function refreshLeaderboardPositions() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LEADERBOARD_REFRESH_EVENT));
}
