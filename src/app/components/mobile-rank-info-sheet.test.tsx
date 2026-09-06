import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileRankInfoSheet } from "@/app/components/mobile-rank-info-sheet";
import { RANKS } from "@/features/progress/progress-stats";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileRankInfoSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("centers the current rank horizontally every time the sheet opens", async () => {
    const currentRank = RANKS[5];
    const { rerender } = render(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );

    const track = await waitFor(() => {
      const element = document.querySelector<HTMLElement>("[data-mobile-rank-carousel]");
      expect(element).not.toBeNull();
      return element!;
    });
    const currentCard = document.querySelector<HTMLElement>("[data-rank-index='5']");
    expect(currentCard).not.toBeNull();

    Object.defineProperty(track, "clientWidth", {
      configurable: true,
      value: 390,
    });
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 500,
      left: 0,
      right: 390,
      top: 100,
      width: 390,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    const currentCardRect = vi.spyOn(currentCard!, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 600,
      height: 180,
      left: 500 - track.scrollLeft,
      right: 690 - track.scrollLeft,
      top: 420,
      width: 190,
      x: 500 - track.scrollLeft,
      y: 420,
      toJSON: () => ({}),
    }));

    rerender(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen={false}
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );
    track.scrollLeft = 0;
    rerender(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(track.scrollLeft).toBe(400);
    });

    rerender(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen={false}
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );
    track.scrollLeft = 0;
    currentCardRect.mockImplementation(() => ({
      bottom: 680,
      height: 180,
      left: 600 - track.scrollLeft,
      right: 790 - track.scrollLeft,
      top: 500,
      width: 190,
      x: 600 - track.scrollLeft,
      y: 500,
      toJSON: () => ({}),
    }));

    rerender(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(track.scrollLeft).toBe(500);
    });
  });

  it("shows the current rank above the total points in its accent color", async () => {
    const currentRank = RANKS[5];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={10_720}
        />
      </LocaleProvider>,
    );

    const rankLabel = await waitFor(() => {
      const element = document.querySelector<HTMLElement>("[data-mobile-current-rank-label]");
      expect(element).not.toBeNull();
      return element!;
    });
    expect(rankLabel).toHaveTextContent("Kelime Ustasi");
    expect(rankLabel).toHaveStyle({ color: "#7309BF" });
    expect(rankLabel?.nextElementSibling).toHaveTextContent("10.720");
  });
});
