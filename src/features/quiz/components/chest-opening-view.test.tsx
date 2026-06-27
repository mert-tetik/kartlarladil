import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("moves the reward points element to the total score and closes after the flight", () => {
    const onComplete = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={100} onComplete={onComplete} />
      </LocaleProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByRole("button", { name: /tap the chest/i }));

    act(() => {
      vi.advanceTimersByTime(900);
    });

    const rewardPoints = document.querySelector<HTMLElement>("[data-chest-reward-points]")!;
    const totalPoints = document.querySelector<HTMLElement>("[data-chest-total-points]")!;

    rewardPoints.getBoundingClientRect = () => ({
      x: 160,
      y: 220,
      width: 96,
      height: 48,
      top: 220,
      left: 160,
      right: 256,
      bottom: 268,
      toJSON: () => {},
    });
    totalPoints.getBoundingClientRect = () => ({
      x: 180,
      y: 16,
      width: 60,
      height: 24,
      top: 16,
      left: 180,
      right: 240,
      bottom: 40,
      toJSON: () => {},
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(document.querySelectorAll("[data-chest-reward-points]")).toHaveLength(1);
    expect(document.querySelector("[data-chest-reward-points]")).toBe(rewardPoints);
    expect(rewardPoints).toHaveClass("fixed");
    expect(rewardPoints.style.transition).toContain("1400ms");

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(totalPoints).toHaveTextContent("120");

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
