import { describe, expect, it } from "vitest";
import { RANDOM_GENERATOR, normalizeGeneratorMode, randomGeneratorsFor, resolveGeneratorSelection } from "@/features/twitter-automation/automation-randomization";

describe("automation randomization", () => {
  it("includes every text generator through its single AI source", () => {
    expect(randomGeneratorsFor("text", ["ai"])).toEqual([
      "fun-post",
      "word-quiz",
      "language-tip",
      "false-friends",
      "daily-challenge",
      "relatable-learner",
      "tiered-vocabulary",
      "example-sentences",
    ]);
  });

  it("keeps self image randomization free of AI image generators", () => {
    expect(randomGeneratorsFor("image", ["self"])).toEqual(["word-of-the-day", "word-of-the-day-poster"]);
  });

  it("resolves video IMG randomization only to image-to-video modes", () => {
    expect(randomGeneratorsFor("video", ["img"])).toEqual([
      "music-word-of-the-day",
      "music-word-of-the-day-poster",
      "music-ai-word-of-the-day",
      "music-ai-mini-quiz",
      "music-ai-false-friends",
      "music-ai-daily-challenge",
      "music-ai-vocabulary-progression",
      "music-ai-example-sentences",
    ]);
  });

  it("maps old random selectors to the single Random selector", () => {
    expect(normalizeGeneratorMode("image", "random-no-ai-image")).toBe(RANDOM_GENERATOR);
    expect(resolveGeneratorSelection("image", "random-no-ai-image", undefined, () => 0.9)).toBe("word-of-the-day-poster");
  });
});
