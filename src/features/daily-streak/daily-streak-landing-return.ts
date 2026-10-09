export const DAILY_STREAK_QUIZ_LANDING_RETURN_KEY = "foxiesdeck:daily-streak:quiz-landing-return";

export function markQuizReturnToLanding() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(DAILY_STREAK_QUIZ_LANDING_RETURN_KEY, "1");
  } catch {
    // A blocked sessionStorage must not prevent the quiz from returning home.
  }
}

export function consumeQuizReturnToLanding() {
  if (typeof window === "undefined") return false;

  try {
    const shouldOpen = window.sessionStorage.getItem(DAILY_STREAK_QUIZ_LANDING_RETURN_KEY) === "1";
    if (shouldOpen) {
      window.sessionStorage.removeItem(DAILY_STREAK_QUIZ_LANDING_RETURN_KEY);
    }
    return shouldOpen;
  } catch {
    return false;
  }
}
