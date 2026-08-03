import { describe, expect, it } from "vitest";
import { getConfusedWordsPhaseIndex, getConfusedWordsSceneIndex } from "@/features/twitter-automation/confused-words-video-renderer";

describe("Confused Words video timeline", () => {
  it("advances visual state through all three eight-scene phases", () => {
    const starts = Array.from({ length: 24 }, (_, index) => index * 1.2);

    expect(getConfusedWordsSceneIndex(starts, 9.59)).toBe(7);
    expect(getConfusedWordsPhaseIndex(getConfusedWordsSceneIndex(starts, 9.6))).toBe(1);
    expect(getConfusedWordsSceneIndex(starts, 19.19)).toBe(15);
    expect(getConfusedWordsSceneIndex(starts, 19.2)).toBe(16);
    expect(getConfusedWordsPhaseIndex(getConfusedWordsSceneIndex(starts, 19.2))).toBe(2);
    expect(getConfusedWordsPhaseIndex(getConfusedWordsSceneIndex(starts, 27.5))).toBe(2);
  });
});
