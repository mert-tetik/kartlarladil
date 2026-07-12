"use client";

const PLAY_REVIEW_ELIGIBILITY_KEY = "foxiesdeck:play-review:pending";

export type PlayReviewEligibilitySource = "quiz" | "game";

function isPlayReviewEligibilitySource(value: string | null): value is PlayReviewEligibilitySource {
  return value === "quiz" || value === "game";
}

export function markPlayReviewEligible(source: PlayReviewEligibilitySource): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PLAY_REVIEW_ELIGIBILITY_KEY, source);
  } catch {
    // A review request is optional, so unavailable storage must not affect gameplay.
  }
}

export function hasPlayReviewEligibility(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return isPlayReviewEligibilitySource(window.localStorage.getItem(PLAY_REVIEW_ELIGIBILITY_KEY));
  } catch {
    return false;
  }
}

export function consumePlayReviewEligibility(): PlayReviewEligibilitySource | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const source = window.localStorage.getItem(PLAY_REVIEW_ELIGIBILITY_KEY);
    window.localStorage.removeItem(PLAY_REVIEW_ELIGIBILITY_KEY);
    return isPlayReviewEligibilitySource(source) ? source : null;
  } catch {
    return null;
  }
}
