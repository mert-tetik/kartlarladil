import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileRankInfoSheet } from "@/app/components/mobile-rank-info-sheet";
import { RANKS } from "@/features/progress/progress-stats";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileRankInfoSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("centers the current rank every time the sheet opens", async () => {
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

    const scrollViewport = await waitFor(() => {
      const element = document.querySelector<HTMLElement>("[data-mobile-rank-scroll]");
      expect(element).not.toBeNull();
      return element!;
    });
    const currentRankElement = document.querySelector<HTMLElement>("[data-current-rank='true']");
    expect(scrollViewport).not.toBeNull();
    expect(currentRankElement).not.toBeNull();

    Object.defineProperty(scrollViewport!, "clientHeight", {
      configurable: true,
      value: 500,
    });
    scrollViewport!.scrollTop = 50;
    vi.spyOn(scrollViewport!, "getBoundingClientRect").mockReturnValue({
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
    const currentRankRect = vi.spyOn(currentRankElement!, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 180,
      left: 100,
      right: 290,
      top: 420,
      width: 190,
      x: 100,
      y: 420,
      toJSON: () => ({}),
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
      expect(scrollViewport!.scrollTop).toBe(210);
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
    scrollViewport!.scrollTop = 0;
    currentRankRect.mockReturnValue({
      bottom: 680,
      height: 180,
      left: 100,
      right: 290,
      top: 500,
      width: 190,
      x: 100,
      y: 500,
      toJSON: () => ({}),
    });

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

    expect(scrollViewport!.scrollTop).toBe(240);
  });
});
