import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";

const payload = {
  viewer: {
    userId: "user-1",
    position: 12,
    displayName: "Fox",
    totalPoints: 240,
    leaderboardVisible: true,
  },
  entries: [],
  canViewLeaderboard: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLeaderboardData", () => {
  it("refreshes every active consumer after a persisted point reward", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLeaderboardData({ refreshOnMount: true }));

    await waitFor(() => {
      expect(result.current.data).toEqual(payload);
    });

    act(() => {
      refreshLeaderboardPositions();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
