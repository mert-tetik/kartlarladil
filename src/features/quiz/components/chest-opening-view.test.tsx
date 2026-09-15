import { act, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

describe("ChestOpeningView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the tier opening video and reveals reward boxes at the video's 3-second mark", () => {
    const onComplete = vi.fn();
    const reward = {
      points: 20,
      rewards: [
        { type: "blue" as const, amount: 2 },
        { type: "purple" as const, amount: 1 },
      ],
      balances: { blue: 2, green: 0, purple: 1 },
    };

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={100}
          reward={reward}
          onComplete={onComplete}
        />
      </LocaleProvider>,
    );

    const video = document.querySelector("[data-chest-opening-video]");
    expect(video).toBeInTheDocument();
    expect(video).not.toHaveAttribute("muted");
    expect(video?.querySelector("source")).toHaveAttribute(
      "src",
      "/chests/openings/wood_chest_opening_v2.mp4",
    );
    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();

    fireEvent.play(video!);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(document.querySelector("[data-chest-reward-sources]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-reward-heading]")).toHaveTextContent("YOUR REWARDS");
    expect(document.querySelectorAll("[data-chest-reward-boxes] > div")).toHaveLength(3);
    expect(document.querySelector("[data-chest-reward-points]")).toHaveTextContent("20");
    expect(document.querySelector('[data-chest-reward-gem="blue"]')).toHaveTextContent("2");
    expect(document.querySelector('[data-chest-reward-gem="purple"]')).toHaveTextContent("1");
    expect(document.querySelector("[data-reward-gem-hud]")).not.toHaveClass("opacity-0");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("holds the ending frame for two seconds before starting the smooth close", () => {
    const onComplete = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[1]} totalPoints={0} onComplete={onComplete} />
      </LocaleProvider>,
    );

    const video = document.querySelector("[data-chest-opening-video]");
    fireEvent.play(video!);
    act(() => {
      fireEvent.ended(video!);
    });

    expect(document.querySelector("[data-chest-opening-video]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector("[data-chest-opening-view]")).toHaveClass("animate-chest-screen-close");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
