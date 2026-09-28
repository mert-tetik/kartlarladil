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

  it("runs stacked points flights together through one shared score display", () => {
    render(
      <LocaleProvider initialLocale="en">
        <MissionRewardOverlay
          modes={[
            { missionId: "points-mission-a", kind: "points", amount: 75, source: new DOMRect(20, 40, 80, 60) },
            { missionId: "points-mission-b", kind: "points", amount: 40, source: new DOMRect(220, 80, 80, 60) },
          ]}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(document.body.querySelector("[data-mission-reward-overlay]")).not.toBeInTheDocument();
    expect(document.body.querySelector("[data-mission-points-flight-stack]")).toHaveAttribute("data-active-point-reward-count", "2");
    expect(document.body.querySelectorAll("[data-main-points-display]")).toHaveLength(1);
    const display = document.body.querySelector<HTMLElement>("[data-main-points-display]");
    const target = display?.querySelector<HTMLElement>(":scope > span");
    if (!target) throw new Error("Main points scatter target was not rendered");
    target.getBoundingClientRect = () => new DOMRect(120, 12, 160, 48);

    const points = display?.querySelector("span.text-lg.font-bold");
    expect(points).toHaveTextContent("420");
    expect(display?.parentElement).toHaveClass("fixed", "pointer-events-none");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.body.querySelectorAll(".animate-quiz-score-icon-flight").length).toBeGreaterThan(0);
  });

  it("runs gem and point scatters concurrently toward the shared reward HUD", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-reward-gem-target")) return new DOMRect(120, 60, 32, 32);
      return new DOMRect(0, 0, 0, 0);
    });

    try {
      render(
        <LocaleProvider initialLocale="en">
          <MissionRewardOverlay
            modes={[
              { missionId: "points-a", kind: "points", amount: 75, source: new DOMRect(20, 40, 80, 60) },
              { missionId: "gems-a", kind: "gems", gemType: "blue", amount: 28, source: new DOMRect(220, 80, 80, 60) },
            ]}
            onComplete={vi.fn()}
          />
        </LocaleProvider>,
      );

      const stack = document.body.querySelector("[data-mission-points-flight-stack]");
      expect(stack).toHaveAttribute("data-active-point-reward-count", "1");
      expect(stack).toHaveAttribute("data-active-gem-reward-count", "1");
      const scoreDisplay = document.body.querySelector<HTMLElement>("[data-main-points-display]");
      const scoreTarget = scoreDisplay?.querySelector<HTMLElement>(":scope > span");
      if (!scoreTarget) throw new Error("Main points scatter target was not rendered");
      scoreTarget.getBoundingClientRect = () => new DOMRect(120, 12, 160, 48);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.body.querySelectorAll(".animate-quiz-score-icon-flight")).toHaveLength(50);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("unmounts the chest reward overlay after the child flow completes", () => {
    const onComplete = vi.fn();

    const view = render(
      <LocaleProvider initialLocale="en">
        <MissionRewardOverlay
          modes={[{ missionId: "chest-mission", kind: "chest", tier: CHEST_TIERS[0] }]}
          onComplete={onComplete}
        />
      </LocaleProvider>,
    );

    const overlay = document.body.querySelector("[data-mission-reward-overlay]");
    expect(overlay).toHaveClass("fixed", "inset-0", "bg-background");
    expect(overlay).not.toHaveClass("backdrop-blur-md");

    fireEvent.click(document.body.querySelector("[data-chest-opening-view-mock]")!);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <LocaleProvider initialLocale="en">
        <MissionRewardOverlay modes={[]} onComplete={onComplete} />
      </LocaleProvider>,
    );
    expect(document.body.querySelector("[data-mission-reward-overlay]")).not.toBeInTheDocument();
  });
});
