import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";

const mockUseSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams()));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

const payload = {
  mode: "points" as const,
  viewer: {
    userId: "user-1",
    position: 12,
    pointsPosition: 12,
    streakPosition: 4,
    displayName: "Fox",
    totalPoints: 240,
    streak: 0,
    leaderboardVisible: true,
  },
  entries: [],
  canViewLeaderboard: true,
};

const refreshedPayload = {
  ...payload,
  viewer: {
    ...payload.viewer,
    position: 8,
    totalPoints: 450,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  mockUseSearchParams.mockReset();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
});

describe("useLeaderboardData", () => {
  it("refreshes every active consumer after a persisted point reward", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refreshedPayload,
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
      expect(result.current.data?.viewer).toMatchObject({
        position: 8,
        totalPoints: 450,
      });
    });
  });

  it("forces the consent-denied UI when the test URL parameter is active", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("leaderboard-consent-test=1"));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLeaderboardData({ refreshOnMount: true }));

    await waitFor(() => {
      expect(result.current.data).toMatchObject({
        canViewLeaderboard: false,
        entries: [],
        viewer: { leaderboardVisible: false },
      });
    });

    expect(payload).toMatchObject({
      mode: "points",
      canViewLeaderboard: true,
      viewer: { leaderboardVisible: true, streak: 0 },
    });
  });

  it("keeps point and streak requests in separate caches", async () => {
    const streakPayload = {
      mode: "streaks" as const,
      viewer: {
        ...payload.viewer,
        streak: 6,
      },
      entries: [],
      canViewLeaderboard: true,
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes("mode=streaks") ? streakPayload : payload),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ mode }: { mode: "points" | "streaks" }) =>
        useLeaderboardData({ mode, refreshOnMount: false }),
      { initialProps: { mode: "points" as "points" | "streaks" } },
    );

    await waitFor(() => expect(result.current.data?.mode).toBe("points"));

    rerender({ mode: "streaks" });

    await waitFor(() => {
      expect(result.current.data).toMatchObject({
        mode: "streaks",
        viewer: { streak: 6 },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leaderboard?mode=streaks",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
