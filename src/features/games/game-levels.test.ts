import {
  FREE_GAME_LEVEL_LIMIT,
  buildLevelConfig,
  getHighestTierForLevel,
  getLevelTimeLimit,
  getMemoryCardCountForLevel,
  getPointsForLevel,
  getTiersForLevel,
  isGameLevelLocked,
} from "./game-levels";

describe("getTiersForLevel", () => {
  it("returns A1 for levels 1-5", () => {
    expect(getTiersForLevel(1)).toEqual(["A1"]);
    expect(getTiersForLevel(5)).toEqual(["A1"]);
  });

  it("returns mixed tiers for transitional ranges", () => {
    expect(getTiersForLevel(6)).toEqual(["A1", "A2"]);
    expect(getTiersForLevel(20)).toEqual(["A2", "B1"]);
  });

  it("returns C1 for very high levels", () => {
    expect(getTiersForLevel(100)).toEqual(["C1"]);
  });
});

describe("getHighestTierForLevel", () => {
  it("returns the highest tier for the level", () => {
    expect(getHighestTierForLevel(1)).toBe("A1");
    expect(getHighestTierForLevel(10)).toBe("A2");
    expect(getHighestTierForLevel(30)).toBe("B1");
    expect(getHighestTierForLevel(100)).toBe("C1");
  });
});

describe("getPointsForLevel", () => {
  it("awards base points for the highest tier within the free levels", () => {
    expect(getPointsForLevel(1)).toBe(10);
    expect(getPointsForLevel(10)).toBe(20);
  });

  it("applies a level multiplier every 10 levels beyond the free limit", () => {
    expect(getPointsForLevel(11)).toBe(20);
    expect(getPointsForLevel(21)).toBe(44);
    expect(getPointsForLevel(51)).toBe(140);
  });
});

describe("getMemoryCardCountForLevel", () => {
  it.each([
    [1, 8],
    [5, 8],
    [6, 12],
    [10, 12],
    [11, 16],
    [15, 16],
    [16, 20],
    [25, 20],
    [26, 24],
  ])("level %i uses %i cards", (level, expected) => {
    expect(getMemoryCardCountForLevel(level)).toBe(expected);
  });
});

describe("getLevelTimeLimit", () => {
  it("gives 3 seconds per memory card", () => {
    expect(getLevelTimeLimit(1, "memory")).toBe(24);
    expect(getLevelTimeLimit(10, "memory")).toBe(36);
    expect(getLevelTimeLimit(26, "memory")).toBe(72);
  });

  it("is based on question count for word challenge", () => {
    expect(getLevelTimeLimit(1, "wordChallenge")).toBe(71);
  });
});

describe("buildLevelConfig", () => {
  it("includes level, tiers, seconds and cardCount", () => {
    const config = buildLevelConfig(5, "memory");
    expect(config.level).toBe(5);
    expect(config.tiers).toEqual(["A1"]);
    expect(config.seconds).toBe(24);
    expect(config.cardCount).toBe(8);
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
