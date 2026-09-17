import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthSession } from "@/features/auth/auth-client";
import { DailyStreakProvider, useDailyStreak } from "./daily-streak-client";
import { syncDailyStreakAction } from "./daily-streak-actions";

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: vi.fn(),
}));

vi.mock("./daily-streak-actions", () => ({
  syncDailyStreakAction: vi.fn(),
}));

const mockUseAuthSession = vi.mocked(useAuthSession);
const mockSyncDailyStreakAction = vi.mocked(syncDailyStreakAction);

function SnapshotProbe() {
  const { snapshot } = useDailyStreak();

  return <output data-testid="daily-streak-snapshot">{snapshot?.currentStreak ?? "empty"}</output>;
}

describe("DailyStreakProvider", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mockUseAuthSession.mockReturnValue({ user: { id: "user-1" } } as ReturnType<typeof useAuthSession>);
    mockSyncDailyStreakAction.mockReset();
  });

  it("retries a failed startup sync and publishes the successful snapshot", async () => {
    mockSyncDailyStreakAction
      .mockRejectedValueOnce(new Error("temporary auth refresh"))
      .mockResolvedValueOnce({
        success: true,
        snapshot: { currentStreak: 3, today: "2026-09-16", loggedDates: ["2026-09-16"] },
      });

    render(
      <DailyStreakProvider>
        <SnapshotProbe />
      </DailyStreakProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("daily-streak-snapshot")).toHaveTextContent("3"), {
      timeout: 2500,
    });
    expect(mockSyncDailyStreakAction).toHaveBeenCalledTimes(2);
  });
});
