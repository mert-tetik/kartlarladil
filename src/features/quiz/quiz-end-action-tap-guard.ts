type PendingQuizEndTap = {
  tapCount: number;
  timer: number;
  singleTapAction: (() => void) | null;
};

const pendingTapsByScreen = new WeakMap<HTMLElement, PendingQuizEndTap>();

/**
 * During a quiz-end screen's entry grace period, defer a single action until
 * the multi-tap window has elapsed. Multi-taps cancel the action; outside the
 * grace period actions remain immediate.
 */
export function runQuizEndActionAfterSingleTap(
  screen: HTMLElement,
  action: () => void,
  tapWindowMs: number,
  isGuardActive: () => boolean = () => screen.dataset.quizEndActionTapGuardActive === "true",
) {
  const pendingTap = pendingTapsByScreen.get(screen);

  if (pendingTap) {
    const quietPeriodMs = Math.max(0, tapWindowMs) + 1;
    window.clearTimeout(pendingTap.timer);
    pendingTap.tapCount += 1;
    pendingTap.singleTapAction = null;
    pendingTap.timer = window.setTimeout(() => {
      pendingTapsByScreen.delete(screen);
    }, quietPeriodMs);
    return;
  }

  if (!isGuardActive()) {
    action();
    return;
  }

  const quietPeriodMs = Math.max(0, tapWindowMs) + 1;
  const nextPendingTap: PendingQuizEndTap = {
    tapCount: 1,
    timer: 0,
    singleTapAction: action,
  };
  nextPendingTap.timer = window.setTimeout(() => {
    pendingTapsByScreen.delete(screen);
    const transitionState = screen.dataset.transitionState;
    if (
      nextPendingTap.tapCount === 1 &&
      nextPendingTap.singleTapAction &&
      transitionState !== "hidden" &&
      transitionState !== "exiting" &&
      screen.getAttribute("aria-hidden") !== "true"
    ) {
      nextPendingTap.singleTapAction();
    }
  }, quietPeriodMs);
  pendingTapsByScreen.set(screen, nextPendingTap);
}
