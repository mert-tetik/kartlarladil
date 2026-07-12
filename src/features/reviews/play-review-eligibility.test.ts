import { beforeEach, describe, expect, it } from "vitest";
import {
  consumePlayReviewEligibility,
  hasPlayReviewEligibility,
  markPlayReviewEligible,
} from "./play-review-eligibility";

describe("Play review eligibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores quiz completion until the landing page consumes it", () => {
    markPlayReviewEligible("quiz");

    expect(hasPlayReviewEligibility()).toBe(true);
    expect(consumePlayReviewEligibility()).toBe("quiz");
    expect(hasPlayReviewEligibility()).toBe(false);
  });

  it("stores game level completion", () => {
    markPlayReviewEligible("game");

    expect(consumePlayReviewEligibility()).toBe("game");
  });

  it("ignores invalid persisted values", () => {
    window.localStorage.setItem("foxiesdeck:play-review:pending", "other");

    expect(hasPlayReviewEligibility()).toBe(false);
    expect(consumePlayReviewEligibility()).toBeNull();
  });
});
