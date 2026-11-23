export const QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS = 500;
export const QUIZ_END_ACTION_TAP_GUARD_GRACE_MS = 2_000;

export type QuizEndTripleTapState = {
  count: number;
  firstTapAt: number;
  screen: Element | null;
};

export function createQuizEndTripleTapState(): QuizEndTripleTapState {
  return { count: 0, firstTapAt: 0, screen: null };
}

export function resetQuizEndTripleTapState(state: QuizEndTripleTapState) {
  state.count = 0;
  state.firstTapAt = 0;
  state.screen = null;
}

export function activateQuizEndPrimaryActionOnTripleTap(
  state: QuizEndTripleTapState,
  screen: Element,
  now: number,
  onActivate: (button: HTMLButtonElement) => void = (button) => button.click(),
): boolean {
  const elapsed = now - state.firstTapAt;
  if (
    state.screen !== screen ||
    state.count === 0 ||
    elapsed < 0 ||
    elapsed > QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS
  ) {
    state.screen = screen;
    state.count = 1;
    state.firstTapAt = now;
    return false;
  }

  state.count += 1;
  if (state.count < 3) return false;

  resetQuizEndTripleTapState(state);

  const isActionAvailable = (button: HTMLButtonElement) => {
    return (
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true" &&
      button.dataset.quizEndContinueLocked !== "true" &&
      button.dataset.performanceRewardsLocked !== "true" &&
      !button.closest('[aria-hidden="true"], [hidden]')
    );
  };
  const actionButton = Array.from(
    screen.querySelectorAll<HTMLButtonElement>("button[data-quiz-end-triple-tap-action]"),
  ).find(isActionAvailable) ?? Array.from(
    screen.querySelectorAll<HTMLButtonElement>("button[data-quiz-end-continue]"),
  ).find(isActionAvailable);

  if (!actionButton) return false;
  onActivate(actionButton);
  return true;
}
