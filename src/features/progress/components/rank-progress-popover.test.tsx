import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { setQuizRankUpDeferred } from "@/features/progress/rank-up-flow";
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
    setQuizRankUpDeferred(false);
    useTutorialStore.setState({ active: false, completed: false, step: 0, testMode: false });
  });

  afterEach(() => {
    setQuizRankUpDeferred(false);
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

    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const rankUpDialog = screen.getByRole("dialog", { name: /Rütbe atlad/ });
    expect(rankUpDialog).toBeVisible();
    expect(playSoundEffect).toHaveBeenCalledTimes(1);
    expect(playSoundEffect).toHaveBeenCalledWith("rank-up-opening");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(playSoundEffect).toHaveBeenCalledTimes(2);
    expect(playSoundEffect).toHaveBeenLastCalledWith("rank-up-reveal");
    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_rank_up", {
      params: {
        rank_id: nextStats.rank.id,
        rank_icon: nextStats.rank.icon,
        total_points: nextStats.totalPoints,
        rank_min_points: nextStats.rank.minPoints,
      },
    });
    expect(within(rankUpDialog).getByRole("heading", { name: "Rütbe atladın" })).toBeVisible();
    expect(within(rankUpDialog).getByText(nextStats.rank.label)).toBeVisible();
    expect(within(rankUpDialog).queryByText("200")).not.toBeInTheDocument();
    expect(within(rankUpDialog).queryByText("Mevcut")).not.toBeInTheDocument();

    fireEvent.click(within(rankUpDialog).getByRole("button", { name: "Rütbe atlama menüsünü kapat" }));

    expect(screen.getByRole("dialog", { name: /Rütbe atlad/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();
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

    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();

    act(() => {
      useTutorialStore.setState({ active: false, completed: true });
    });

    expect(screen.getByRole("dialog", { name: /Rütbe atlad/ })).toBeVisible();
  });

  it("does not open the global rank-up menu while a quiz owns the result sequence", () => {
    vi.useFakeTimers();
    const nextStats = makeStats(200);
    const { rerender } = renderRank(<RankProgressPopover stats={makeStats(190)} />);

    setQuizRankUpDeferred(true);
    rerender(<RankProgressPopover stats={nextStats} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();
  });

  it("opens the rank-up overlay in test mode from the URL param", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?rank-up-test=1");

    renderRank(<RankProgressPopover stats={makeStats(0)} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const rankUpDialog = screen.getByRole("dialog", { name: /Rütbe atlad/ });
    expect(rankUpDialog).toBeVisible();

    const fullScreenSurface = rankUpDialog.querySelector(".relative.z-10 > div");
    expect(fullScreenSurface).toHaveClass("h-full");
    expect(fullScreenSurface).toHaveClass("w-full");

    fireEvent.click(within(rankUpDialog).getByRole("button", { name: "Rütbe atlama menüsünü kapat" }));
    expect(screen.getByRole("dialog", { name: /Rütbe atlad/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.queryByRole("dialog", { name: /Rütbe atlad/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("dialog", { name: /Rütbe atlad/ })).toBeVisible();
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
