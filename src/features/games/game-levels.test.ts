import {
  FREE_GAME_LEVEL_LIMIT,
  buildLevelConfig,
  getCardTiersForLevel,
  getHighestTierForLevel,
  getLevelTimeLimit,
  getMemoryCardCountForLevel,
  getMemoryRevealDurationMs,
  getPointsForLevel,
  getWordChallengeQuestionCountForLevel,
  isGameLevelLocked,
} from "./game-levels";

describe("getHighestTierForLevel", () => {
  it("returns the single highest tier for the level range", () => {
    expect(getHighestTierForLevel(1)).toBe("A1");
    expect(getHighestTierForLevel(10)).toBe("A1");
    expect(getHighestTierForLevel(11)).toBe("A2");
    expect(getHighestTierForLevel(30)).toBe("B1");
    expect(getHighestTierForLevel(41)).toBe("C1");
  });
});

describe("getCardTiersForLevel", () => {
  it("includes the highest tier and every tier below it", () => {
    expect(getCardTiersForLevel(1)).toEqual(["A1"]);
    expect(getCardTiersForLevel(11)).toEqual(["A1", "A2"]);
    expect(getCardTiersForLevel(21)).toEqual(["A1", "A2", "B1"]);
    expect(getCardTiersForLevel(41)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
  });
});

describe("getPointsForLevel", () => {
  it("awards base points for the highest tier within the free levels", () => {
    expect(getPointsForLevel(1)).toBe(10);
    expect(getPointsForLevel(10)).toBe(10);
  });

  it("applies a level multiplier beyond the free limit", () => {
    expect(getPointsForLevel(11)).toBe(20);
    expect(getPointsForLevel(21)).toBe(44);
    expect(getPointsForLevel(51)).toBe(140);
  });
});

describe("getMemoryCardCountForLevel", () => {
  it("doubles the unlock thresholds for memory board sizes", () => {
    expect(getMemoryCardCountForLevel(1)).toBe(8);
    expect(getMemoryCardCountForLevel(10)).toBe(8);
    expect(getMemoryCardCountForLevel(11)).toBe(12);
    expect(getMemoryCardCountForLevel(21)).toBe(16);
    expect(getMemoryCardCountForLevel(31)).toBe(20);
    expect(getMemoryCardCountForLevel(41)).toBe(24);
  });
});

describe("getMemoryRevealDurationMs", () => {
  it("matches the requested reveal durations", () => {
    expect(getMemoryRevealDurationMs(8)).toBe(3000);
    expect(getMemoryRevealDurationMs(12)).toBe(4000);
    expect(getMemoryRevealDurationMs(16)).toBe(6000);
    expect(getMemoryRevealDurationMs(20)).toBe(6000);
    expect(getMemoryRevealDurationMs(24)).toBe(7000);
  });
});

describe("getWordChallengeQuestionCountForLevel", () => {
  it("increases question count at the requested level thresholds", () => {
    expect(getWordChallengeQuestionCountForLevel(1)).toBe(7);
    expect(getWordChallengeQuestionCountForLevel(10)).toBe(7);
    expect(getWordChallengeQuestionCountForLevel(11)).toBe(15);
    expect(getWordChallengeQuestionCountForLevel(21)).toBe(20);
    expect(getWordChallengeQuestionCountForLevel(31)).toBe(25);
  });
});

describe("getLevelTimeLimit", () => {
  it("gives three seconds per memory card", () => {
    expect(getLevelTimeLimit(1, "memory")).toBe(24);
    expect(getLevelTimeLimit(11, "memory")).toBe(36);
    expect(getLevelTimeLimit(41, "memory")).toBe(72);
  });

  it("gives two seconds per word challenge question", () => {
    expect(getLevelTimeLimit(1, "wordChallenge")).toBe(14);
    expect(getLevelTimeLimit(11, "wordChallenge")).toBe(30);
    expect(getLevelTimeLimit(31, "wordChallenge")).toBe(50);
  });
});

describe("buildLevelConfig", () => {
  it("includes level, card tiers and seconds", () => {
    const config = buildLevelConfig(5, "memory");
    expect(config.level).toBe(5);
    expect(config.tiers).toEqual(["A1"]);
    expect(config.seconds).toBeGreaterThan(0);
  });
});

describe("isGameLevelLocked", () => {
  it("returns false for levels up to the free limit", () => {
    expect(isGameLevelLocked(FREE_GAME_LEVEL_LIMIT)).toBe(false);
  });

  it("returns true beyond the free limit", () => {
    expect(isGameLevelLocked(FREE_GAME_LEVEL_LIMIT + 1)).toBe(true);
  });
});
