import { afterEach, describe, expect, it, vi } from "vitest";
import { QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS } from "@/features/quiz/quiz-end-triple-tap";
import { runMissionCardActionAfterSingleTap } from "./mission-card-tap-guard";

const TAP_WINDOW_MS = QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS;
const TAP_QUIET_PERIOD_MS = TAP_WINDOW_MS + 1;

describe("runMissionCardActionAfterSingleTap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a single mission action after the quiz multi-tap window", () => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.transitionState = "entering";
    screen.dataset.missionTapGuardActive = "true";
    screen.setAttribute("aria-hidden", "false");
    const action = vi.fn();

    runMissionCardActionAfterSingleTap(screen, action, TAP_WINDOW_MS);
    vi.advanceTimersByTime(TAP_WINDOW_MS - 1);
    expect(action).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(action).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledOnce();
  });

  it.each([2, 3])("suppresses a %i-tap mission action", (tapCount) => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.transitionState = "entering";
    screen.dataset.missionTapGuardActive = "true";
    screen.setAttribute("aria-hidden", "false");
    const action = vi.fn();

    runMissionCardActionAfterSingleTap(screen, action, TAP_WINDOW_MS);
    for (let tap = 1; tap < tapCount; tap += 1) {
      vi.advanceTimersByTime(100);
      runMissionCardActionAfterSingleTap(screen, action, TAP_WINDOW_MS);
    }
    vi.advanceTimersByTime(TAP_QUIET_PERIOD_MS);

    expect(action).not.toHaveBeenCalled();
  });

  it("does not run a queued action after the rewards screen starts closing", () => {
    vi.useFakeTimers();
    const screen = document.createElement("section");
    screen.dataset.transitionState = "entering";
    screen.dataset.missionTapGuardActive = "true";
    screen.setAttribute("aria-hidden", "false");
    const action = vi.fn();

    runMissionCardActionAfterSingleTap(screen, action, TAP_WINDOW_MS);
    screen.dataset.transitionState = "exiting";
    vi.advanceTimersByTime(TAP_QUIET_PERIOD_MS);

    expect(action).not.toHaveBeenCalled();
  });

  it("runs mission actions immediately after the screen's guard period", () => {
    const screen = document.createElement("section");
    screen.dataset.missionTapGuardActive = "false";
    screen.dataset.transitionState = "entering";
    screen.setAttribute("aria-hidden", "false");
    const action = vi.fn();

    runMissionCardActionAfterSingleTap(screen, action, TAP_WINDOW_MS);

    expect(action).toHaveBeenCalledOnce();
  });
});
