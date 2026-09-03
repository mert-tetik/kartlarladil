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

    expect(document.querySelector("h2")).not.toBeInTheDocument();
    expect(document.querySelector("[data-chest-tier-name]")).toHaveClass("font-super-water", "text-white");
    expect(document.querySelector("[data-chest-ground-shadow]")).toHaveClass("rounded-full", "blur-[6px]");
    expect(document.querySelector("[data-chest-opening-view]")).toHaveClass("bg-[#121212]");
    expect(document.querySelector("[data-chest-opening-background]")).toHaveClass("opacity-0");
    expect(document.querySelector("[data-chest-auto-open]")).toHaveClass("animate-chest-appear");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(document.querySelector("[data-chest-opening-layout]")).toHaveClass("min-h-full");
    expect(document.querySelector("[data-chest-total-points-shell]")).toBeInTheDocument();
    expect(document.querySelector("[data-reward-gem-hud]")).toHaveClass("opacity-0", "translate-y-2");
    expect(document.querySelector("[data-chest-opening-background]")).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(document.querySelector("[data-chest-opening-background]")).toHaveClass("opacity-0");
    expect(document.querySelector(".animate-chest-charge")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(780);
    });

    expect(document.querySelector("[data-chest-opening-background]")).toHaveClass("opacity-100");
    expect(document.querySelector(".animate-chest-pulse")).toBeInTheDocument();
    expect(document.querySelector("[data-reward-gem-hud]")).not.toHaveClass("opacity-0", "translate-y-2");

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(document.querySelector("[data-chest-reward-points]")).toBeInTheDocument();
    const rewardStack = document.querySelector("[data-chest-reward-stack]");
    expect(rewardStack).toHaveClass("font-super-water");
    expect(rewardStack).not.toHaveTextContent("You won!");
    expect(rewardStack).not.toHaveTextContent("points");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(document.querySelector("[data-chest-reward-points]")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
