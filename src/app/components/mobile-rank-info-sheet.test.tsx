import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileRankInfoSheet } from "@/app/components/mobile-rank-info-sheet";
import { RANKS, RANK_ACCENT_COLORS } from "@/features/progress/progress-stats";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileRankInfoSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens as an opaque full-screen surface with the selected rank centered", async () => {
    const currentRank = RANKS[5];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileRankInfoSheet
          isOpen
          onClose={vi.fn()}
          rank={currentRank}
          totalPoints={currentRank.minPoints}
        />
      </LocaleProvider>,
    );

    const overlay = await waitFor(() => {
      const element = document.querySelector<HTMLElement>("[data-rank-details-overlay]");
      expect(element).not.toBeNull();
      return element!;
    });
    const track = document.querySelector<HTMLElement>("[data-mobile-rank-carousel]")!;
    const trackWidth = track.clientWidth || window.innerWidth;

    await waitFor(() => expect(track.scrollLeft).toBe(5 * trackWidth));

    expect(overlay).toHaveClass("bg-black");
    expect(overlay).toHaveAttribute("data-rank-details-phase", "open");
    expect(document.querySelector("[data-rank-details-gradient]")).toHaveStyle({
      backgroundImage: expect.stringContaining("rgba(115, 9, 191, 0.82)"),
    });
    expect(document.querySelector("[data-rank-index='5'] [data-rank-visual]")).toHaveClass(
      "absolute",
      "left-1/2",
      "top-1/2",
    );
  });

  it("recenters the current rank every time the overlay opens", async () => {
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
    const trackWidth = track.clientWidth || window.innerWidth;

    await waitFor(() => expect(track.scrollLeft).toBe(5 * trackWidth));

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

    await waitFor(() => expect(track.scrollLeft).toBe(5 * trackWidth));
  });

  it("changes the highlighted rank with a touch swipe", async () => {
    const currentRank = RANKS[5];

    render(
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
    const trackWidth = track.clientWidth || window.innerWidth;
    await waitFor(() => expect(track.scrollLeft).toBe(5 * trackWidth));

    fireEvent.pointerDown(track, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 320,
    });
    fireEvent.pointerMove(track, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
    });
    fireEvent.pointerUp(track, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
    });

    await waitFor(() => {
      expect(document.querySelector("[data-rank-index='6']")).toHaveAttribute("data-highlighted", "true");
    });
    expect(document.querySelector("[data-rank-index='5']")).toHaveAttribute("data-highlighted", "false");
  });

  it("updates the rank label and gradient when a different rank is highlighted", async () => {
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

    const label = await waitFor(() => {
      const element = document.querySelector<HTMLElement>("[data-mobile-current-rank-label]");
      expect(element).not.toBeNull();
      return element!;
    });
    expect(label).toHaveTextContent("Kelime Ustasi");
    expect(label).toHaveStyle({ color: RANK_ACCENT_COLORS["kelime-ustasi"] });
    expect(label.nextElementSibling).toHaveTextContent("10.720");
  });
});
