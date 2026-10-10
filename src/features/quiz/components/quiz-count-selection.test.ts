import { describe, expect, it } from "vitest";
import {
  getAdditionalCardsNeededForChest,
  getQuizCountOptions,
} from "@/features/quiz/components/quiz-count-selection";

describe("getQuizCountOptions", () => {
  it("uses all available cards for the quick option when fewer than ten exist", () => {
    expect(getQuizCountOptions(3)).toEqual([3, 20, 30, 50]);
  });

  it("keeps the standard options when ten or more cards exist", () => {
    expect(getQuizCountOptions(10)).toEqual([10, 20, 30, 50]);
    expect(getQuizCountOptions(24)).toEqual([10, 20, 30, 50]);
  });
});

describe("getAdditionalCardsNeededForChest", () => {
  it("returns the number of cards needed to reach the first chest threshold", () => {
    expect(getAdditionalCardsNeededForChest(3)).toBe(7);
    expect(getAdditionalCardsNeededForChest(9)).toBe(1);
  });

  it("does not show a requirement once ten cards are available", () => {
    expect(getAdditionalCardsNeededForChest(10)).toBe(0);
    expect(getAdditionalCardsNeededForChest(24)).toBe(0);
  });
});
