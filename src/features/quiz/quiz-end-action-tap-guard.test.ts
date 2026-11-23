import { afterEach, describe, expect, it, vi } from "vitest";
import { runQuizEndActionAfterSingleTap } from "./quiz-end-action-tap-guard";

describe("runQuizEndActionAfterSingleTap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the multi-tap window only while the screen-entry guard is active", () => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.quizEndActionTapGuardActive = "true";
    const action = vi.fn();

    runQuizEndActionAfterSingleTap(screen, action, 500);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(501);
    expect(action).toHaveBeenCalledOnce();

    screen.dataset.quizEndActionTapGuardActive = "false";
    runQuizEndActionAfterSingleTap(screen, action, 500);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("cancels the action when a second tap arrives during the guarded window", () => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.quizEndActionTapGuardActive = "true";
    const action = vi.fn();

    runQuizEndActionAfterSingleTap(screen, action, 500);
    vi.advanceTimersByTime(120);
    runQuizEndActionAfterSingleTap(screen, action, 500);
    vi.advanceTimersByTime(501);

    expect(action).not.toHaveBeenCalled();
  });

  it("does not run a deferred action after the screen starts exiting", () => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.quizEndActionTapGuardActive = "true";
    const action = vi.fn();

    runQuizEndActionAfterSingleTap(screen, action, 500);
    screen.dataset.transitionState = "exiting";
    vi.advanceTimersByTime(501);

    expect(action).not.toHaveBeenCalled();
  });
});
