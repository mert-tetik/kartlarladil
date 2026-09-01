import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizStreakCelebrationView } from "./quiz-streak-celebration-view";

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
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

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(background).toHaveClass("animate-streak-celebration-background-exit");
    expect(number).toHaveClass("animate-streak-celebration-number-exit");
    expect(icon).toHaveClass("animate-streak-celebration-icon-exit");
    expect(background?.getAttribute("style")).toContain("--streak-background-fall-y");
    expect(number?.getAttribute("style")).toContain("--streak-number-fall-rotation");
    expect(icon?.getAttribute("style")).toContain("--streak-icon-fall-rotation");

    act(() => {
      vi.advanceTimersByTime(820);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
