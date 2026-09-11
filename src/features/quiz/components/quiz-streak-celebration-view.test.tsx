import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import confetti from "canvas-confetti";
import { QuizStreakCelebrationView } from "./quiz-streak-celebration-view";
import { vibrate } from "@/lib/vibration";

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("QuizStreakCelebrationView animations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the staggered entrance and independent rigid-body exit motion", () => {
    const onComplete = vi.fn();

    render(<QuizStreakCelebrationView streak={5} onComplete={onComplete} />);

    const background = document.querySelector("[data-streak-celebration-background]");
    const number = document.querySelector("[data-streak-count]");
    const icon = document.querySelector("[data-streak-fire-icon]");

    expect(background).toHaveClass("animate-streak-celebration-background-enter");
    expect(number?.parentElement).toHaveClass("animate-streak-celebration-copy-enter");
    expect(onComplete).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
    expect(document.querySelector("[data-streak-shockwave]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-streak-text-shockwave]")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(399);
    });

    expect(document.querySelector("[data-streak-shockwave]")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const shockwave = document.querySelector("[data-streak-shockwave]");
    const textShockwave = document.querySelector("[data-streak-text-shockwave]");
    expect(shockwave).toBeInTheDocument();
    expect(shockwave?.parentElement).toHaveAttribute("data-streak-fire-shell");
    expect(shockwave).toHaveClass("z-0");
    expect(textShockwave).toBeInTheDocument();
    expect(textShockwave?.parentElement).toHaveAttribute("data-streak-count-shell");
    expect(textShockwave).toHaveClass("z-20");
    expect(vibrate).toHaveBeenCalledWith("streak-shockwave");
    expect(background).toHaveAttribute("data-streak-background-color", "#6FAF64");
    expect(background).toHaveStyle({ backgroundColor: "#6FAF64" });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(vibrate).toHaveBeenCalledWith("streak-exit");
    expect(confetti).toHaveBeenCalledWith({
      particleCount: 150,
      spread: 105,
      origin: { x: 0.5, y: 0.5 },
      colors: ["#ef4444", "#ffffff"],
      disableForReducedMotion: true,
    });
    expect(background).toHaveClass("animate-streak-celebration-background-exit");
    expect(background).toHaveAttribute("data-streak-background-color", "#6FAF64");
    expect(background).toHaveStyle({ backgroundColor: "#6FAF64" });
    expect(number?.getAttribute("style")).toContain("translate3d(");
    expect(icon?.getAttribute("style")).toContain("translate3d(");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [10, "#3B82F6"],
    [15, "#8B5CF6"],
    [20, "#F59E0B"],
    [50, "#F59E0B"],
  ])("uses the %s streak tier color after the shockwave", (streak, color) => {
    render(<QuizStreakCelebrationView streak={streak} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const background = document.querySelector("[data-streak-celebration-background]");
    expect(background).toHaveAttribute("data-streak-background-color", color);
    expect(background).toHaveStyle({ backgroundColor: color });
  });
});
