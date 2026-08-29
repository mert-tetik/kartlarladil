import { describe, expect, it } from "vitest";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "./score-flight";

describe("score flight awards", () => {
  it("increases each capped icon enough to award the full 100-point reward", () => {
    const iconCount = getScoreFlightIconCount(100);

    expect(iconCount).toBe(25);
    expect(
      Array.from({ length: iconCount }, (_, index) =>
        getScoreFlightAwardAtArrival(100, iconCount, index + 1),
      ),
    ).toEqual(Array.from({ length: 25 }, (_, index) => (index + 1) * 4));
  });

  it("keeps the total exact for rewards that do not divide evenly across icons", () => {
    const iconCount = getScoreFlightIconCount(5);

    expect(iconCount).toBe(3);
    expect(
      Array.from({ length: iconCount }, (_, index) =>
        getScoreFlightAwardAtArrival(5, iconCount, index + 1),
      ),
    ).toEqual([2, 3, 5]);
  });

  it.each([1, 2, 3, 4, 5])("ends at the exact star reward for %i stars", (stars) => {
    const iconCount = getScoreFlightIconCount(stars);

    expect(getScoreFlightAwardAtArrival(stars, iconCount, iconCount)).toBe(stars);
  });
});
