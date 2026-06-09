import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { playSoundEffect } from "@/lib/sound-effects";
import type { ProgressStats } from "@/types/domain";

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

describe("RankProgressPopover", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens the rank ladder from the navbar rank display", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Rank ilerlemesini göster" }));

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

  it("opens a rank-up menu when the user reaches a new rank", () => {
    vi.useFakeTimers();
    const nextStats = makeStats(100);

    const { rerender } = render(<RankProgressPopover stats={makeStats(90)} />);

    rerender(<RankProgressPopover stats={nextStats} />);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.queryByRole("dialog", { name: /Rank atlad/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const rankUpDialog = screen.getByRole("dialog", { name: /Rank atlad/ });
    expect(rankUpDialog).toBeVisible();
    expect(playSoundEffect).toHaveBeenCalledWith("rank-up");
    expect(within(rankUpDialog).getByText("Rank atladın")).toBeVisible();
    expect(within(rankUpDialog).getByText(nextStats.rank.label)).toBeVisible();
    expect(within(rankUpDialog).getByText("100 puan")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Rankleri/ }));

    expect(screen.getByRole("dialog", { name: "Rank ilerlemesi" })).toBeVisible();
  });
});

function makeStats(totalPoints: number): ProgressStats {
  return {
    ...EMPTY_PROGRESS_STATS,
    totalPoints,
    ...getNextRankProgress(totalPoints),
  };
}
