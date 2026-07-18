import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import type { ProgressStats } from "@/types/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: vi.fn(),
}));

describe("RankProgressPopover", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    useTutorialStore.setState({ active: false, completed: false, step: 0, testMode: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps the rank trigger visible for mobile navigation", () => {
    renderRank(<RankProgressPopover stats={makeStats(0)} />);

    expect(screen.getByRole("button", { name: "Rank ilerlemesini göster" }).parentElement).not.toHaveClass("hidden");
  });

  it("opens the rank ladder from the navbar rank display", () => {
    const rankProgress = getNextRankProgress(500);

    renderRank(
      <RankProgressPopover
        stats={{
          ...EMPTY_PROGRESS_STATS,
          totalPoints: 500,
          ...rankProgress,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rank ilerlemesini göster" }));

    expect(screen.getByRole("dialog", { name: "Rank ilerlemesi" })).toBeVisible();
    expect(screen.getByText("Kelime Toplayıcı için 100 puan kaldı")).toBeVisible();

    for (const rank of RANKS) {
      expect(screen.getAllByText(rank.label).length).toBeGreaterThan(0);
    }
  });

  it("shows a temporary score gain before updating the navbar points", () => {
    vi.useFakeTimers();

    const { rerender } = renderRank(<RankProgressPopover stats={makeStats(0)} />);

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
    const nextStats = makeStats(200);

    const { rerender } = renderRank(<RankProgressPopover stats={makeStats(190)} />);

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
    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_rank_up", {
      params: {
        rank_id: nextStats.rank.id,
        rank_icon: nextStats.rank.icon,
        total_points: nextStats.totalPoints,
        rank_min_points: nextStats.rank.minPoints,
      },
    });
    expect(within(rankUpDialog).getByText("Rank atladın")).toBeVisible();
    expect(within(rankUpDialog).getByText(nextStats.rank.label)).toBeVisible();
    expect(within(rankUpDialog).getByText("200")).toBeVisible();
    expect(within(rankUpDialog).queryByText("200 puan")).not.toBeInTheDocument();
    expect(rankUpDialog.querySelector('img[src*="score-icon.png"]')).toBeInTheDocument();
    expect(rankUpDialog.querySelector("[data-rank-up-total-score]")).toHaveClass("scale-125");

    expect(within(rankUpDialog).getByRole("button", { name: "Devam" })).toHaveClass("bg-gradient-to-r", "from-amber-400", "to-orange-500");

    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(screen.queryByRole("dialog", { name: /Rank atlad/ })).not.toBeInTheDocument();
  });

  it("defers the rank-up menu until the landing tutorial has finished", () => {
    vi.useFakeTimers();
    const nextStats = makeStats(200);
    const { rerender } = renderRank(<RankProgressPopover stats={makeStats(190)} />);

    useTutorialStore.setState({ active: true, completed: false, step: 0, testMode: false });
    rerender(<RankProgressPopover stats={nextStats} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.queryByRole("dialog", { name: /Rank atlad/ })).not.toBeInTheDocument();

    act(() => {
      useTutorialStore.setState({ active: false, completed: true });
    });

    expect(screen.getByRole("dialog", { name: /Rank atlad/ })).toBeVisible();
  });

  it("opens the rank-up overlay in test mode from the URL param", () => {
    window.history.replaceState({}, "", "/?rank-up-test=1");

    renderRank(<RankProgressPopover stats={makeStats(0)} />);

    const rankUpDialog = screen.getByRole("dialog", { name: /Rank atlad/ });
    expect(rankUpDialog).toBeVisible();

    const fullScreenSurface = rankUpDialog.querySelector(".relative.z-10 > div");
    expect(fullScreenSurface).toHaveClass("h-full");
    expect(fullScreenSurface).toHaveClass("w-full");
  });
});

function renderRank(ui: ReactElement) {
  const result = render(<LocaleProvider initialLocale="tr">{ui}</LocaleProvider>);

  return {
    ...result,
    rerender(nextUi: ReactElement) {
      result.rerender(<LocaleProvider initialLocale="tr">{nextUi}</LocaleProvider>);
    },
  };
}

function makeStats(totalPoints: number): ProgressStats {
  return {
    ...EMPTY_PROGRESS_STATS,
    totalPoints,
    ...getNextRankProgress(totalPoints),
  };
}
