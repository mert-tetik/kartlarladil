import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";

describe("RankProgressPopover", () => {
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
});
