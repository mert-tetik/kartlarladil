import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizStreakCelebrationView } from "./quiz-streak-celebration-view";
import { vibrate } from "@/lib/vibration";

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
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

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(vibrate).toHaveBeenCalledWith("streak-break");
    expect(background?.getAttribute("style")).toContain("translate3d(");
    expect(number?.getAttribute("style")).toContain("translate3d(");
    expect(icon?.getAttribute("style")).toContain("translate3d(");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
