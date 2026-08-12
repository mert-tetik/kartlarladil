import { describe, expect, it } from "vitest";
import { AUTOMATION_GENERATOR_OPTIONS, RANDOM_GENERATOR, normalizeGeneratorMode, randomGeneratorsFor, resolveGeneratorSelection } from "@/features/twitter-automation/automation-randomization";

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
    expect(randomGeneratorsFor("image", ["self"])).toEqual([
      "word-of-the-day",
      "word-of-the-day-poster",
      "vocabulary-carousel",
      "tier-progression-carousel",
      "self-mini-quiz",
      "self-false-friends",
      "self-daily-challenge",
      "self-vocabulary-progression",
      "self-example-sentences",
    ]);
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
      "music-self-mini-quiz",
      "music-self-false-friends",
      "music-self-daily-challenge",
      "music-self-vocabulary-progression",
      "music-self-example-sentences",
    ]);
  });

  it("offers every studio-only image and browser-video mode to automation", () => {
    const imageModes = AUTOMATION_GENERATOR_OPTIONS.image.map((option) => option.value);
    const videoModes = AUTOMATION_GENERATOR_OPTIONS.video.map((option) => option.value);
    expect(imageModes).toEqual(expect.arrayContaining([
      "vocabulary-carousel",
      "tier-progression-carousel",
      "self-mini-quiz",
      "self-false-friends",
      "self-daily-challenge",
      "self-vocabulary-progression",
      "self-example-sentences",
    ]));
    expect(videoModes).toEqual(expect.arrayContaining([
      "marketing-dialogue-video",
      "learning-dialogue-video",
      "tier-progression-video",
      "vocabulary-quiz-video",
      "sentence-check-video",
      "sentence-translation-video",
      "music-self-mini-quiz",
      "music-self-false-friends",
      "music-self-daily-challenge",
      "music-self-vocabulary-progression",
      "music-self-example-sentences",
    ]));
  });

  it("maps old random selectors to the single Random selector", () => {
    expect(normalizeGeneratorMode("image", "random-no-ai-image")).toBe(RANDOM_GENERATOR);
    expect(resolveGeneratorSelection("image", "random-no-ai-image", undefined, () => 0.9)).toBe("self-example-sentences");
  });
});
