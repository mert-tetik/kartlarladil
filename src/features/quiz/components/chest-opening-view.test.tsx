import { act, render } from "@testing-library/react";
import { vi } from "vitest";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

describe("ChestOpeningView", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 16),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => window.clearTimeout(id),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: originalCancelAnimationFrame,
    });
  });

  it("auto-opens the chest without requiring a tap", () => {
    const onComplete = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={100} onComplete={onComplete} />
      </LocaleProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(document.querySelector("[data-chest-opening-layout]")).toHaveClass("min-h-full");
    expect(document.querySelector("[data-chest-total-points-shell]")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(document.querySelector("[data-chest-reward-points]")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
