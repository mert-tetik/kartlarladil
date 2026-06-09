import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import type { ProgressStats } from "@/types/domain";

describe("RankProgressPopover", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the rank ladder from the navbar rank display", async () => {
    const user = userEvent.setup();
    const rankProgress = getNextRankProgress(250);

    render(
      <RankProgressPopover
        stats={{
          ...EMPTY_PROGRESS_STATS,
          totalPoints: 250,
          ...rankProgress,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Rank ilerlemesini göster" }));

    expect(screen.getByRole("dialog", { name: "Rank ilerlemesi" })).toBeVisible();
    expect(screen.getByText("Kelime Toplayıcı için 50 puan kaldı")).toBeVisible();

    for (const rank of RANKS) {
      expect(screen.getAllByText(rank.label).length).toBeGreaterThan(0);
    }
  });

  it("shows a temporary score gain before updating the navbar points", () => {
    vi.useFakeTimers();

    const { rerender } = render(<RankProgressPopover stats={makeStats(0)} />);

    expect(screen.getByText("0 puan")).toBeVisible();

    rerender(<RankProgressPopover stats={makeStats(40)} />);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText("+40")).toBeVisible();
    expect(screen.getByText("0 puan")).toBeVisible();
    expect(screen.queryByText("40 puan")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText("40 puan")).toBeVisible();
    expect(screen.queryByText("+40")).not.toBeInTheDocument();
  });
});

function makeStats(totalPoints: number): ProgressStats {
  return {
    ...EMPTY_PROGRESS_STATS,
    totalPoints,
    ...getNextRankProgress(totalPoints),
  };
}
