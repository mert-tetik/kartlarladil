import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { MissionRewardOverlay } from "./mission-reward-overlay";

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({
    stats: { totalPoints: 420 },
  }),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

vi.mock("@/features/quiz/components/chest-opening-view", () => ({
  ChestOpeningView: ({ onComplete }: { onComplete: () => void }) => (
    <button data-chest-opening-view-mock onClick={onComplete}>
      close chest
    </button>
  ),
}));

describe("MissionRewardOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the mission points reward as a full-screen layout", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <MissionRewardOverlay mode={{ kind: "points", amount: 75 }} onComplete={vi.fn()} />
      </LocaleProvider>,
    );

    expect(container.querySelector("[data-mission-reward-overlay]")).toHaveClass("fixed", "inset-0");
    expect(container.querySelector("[data-mission-points-celebration]")).toHaveClass("min-h-full");
    expect(container.querySelector("[data-mission-total-points-shell]")).toBeInTheDocument();
    expect(container.querySelector("[data-mission-total-points]")).toHaveTextContent("420");
  });

  it("unmounts the chest reward overlay after the child flow completes", () => {
    const onComplete = vi.fn();

    const { container } = render(
      <LocaleProvider initialLocale="en">
        <MissionRewardOverlay
          mode={{ kind: "chest", tier: CHEST_TIERS[0] }}
          onComplete={onComplete}
        />
      </LocaleProvider>,
    );

    fireEvent.click(container.querySelector("[data-chest-opening-view-mock]")!);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-mission-reward-overlay]")).not.toBeInTheDocument();
  });
});
