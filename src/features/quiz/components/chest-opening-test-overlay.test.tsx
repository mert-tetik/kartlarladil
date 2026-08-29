import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { CHEST_TIERS, type ChestTierDefinition } from "@/features/quiz/chest-rewards";
import { ChestOpeningTestOverlay } from "./chest-opening-test-overlay";

vi.mock("./chest-opening-view", () => ({
  ChestOpeningView: ({ tier, totalPoints, onComplete }: {
    tier: ChestTierDefinition;
    totalPoints: number;
    onComplete: () => void;
  }) => (
    <button
      data-chest-opening-view-mock
      data-chest-tier={tier.tier}
      data-total-points={totalPoints}
      onClick={onComplete}
    >
      open {tier.tier}
    </button>
  ),
}));

describe("ChestOpeningTestOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("stays disabled without the test URL parameter", () => {
    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningTestOverlay />
      </LocaleProvider>,
    );

    expect(document.body.querySelector("[data-chest-opening-test-overlay]")).not.toBeInTheDocument();
  });

  it("cycles through different chests one second after each visual flow completes without points", () => {
    window.history.replaceState({}, "", "/?chest-opening-test=1");

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningTestOverlay />
      </LocaleProvider>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(document.body.querySelector("[data-chest-opening-test-tier]")).toHaveAttribute("data-chest-opening-test-tier", "wood");
    expect(document.body.querySelector("[data-chest-opening-view-mock]")).toHaveAttribute("data-total-points", "0");

    fireEvent.click(document.body.querySelector("[data-chest-opening-view-mock]")!);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(document.body.querySelector("[data-chest-opening-test-overlay]")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.body.querySelector("[data-chest-opening-test-tier]")).toHaveAttribute("data-chest-opening-test-tier", "iron");
  });

  it("wraps back to the first chest after showing every tier", () => {
    window.history.replaceState({}, "", "/?chest-opening-test=true");

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningTestOverlay />
      </LocaleProvider>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    for (let index = 0; index < CHEST_TIERS.length; index += 1) {
      fireEvent.click(document.body.querySelector("[data-chest-opening-view-mock]")!);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(document.body.querySelector("[data-chest-opening-test-tier]")).toHaveAttribute("data-chest-opening-test-tier", "wood");
  });
});
