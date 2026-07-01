import { useGameProgressStore } from "./game-progress-store";
import { getPointsForLevel } from "./game-levels";

describe("useGameProgressStore", () => {
  it("starts with level 1 and zero points", () => {
    const state = useGameProgressStore.getState();
    expect(state.getProgress("memory")).toEqual({ currentLevel: 1, bestLevel: 0, totalPoints: 0 });
  });

  it("unlocks the next level and awards points on completion", () => {
    const { completeLevel, getProgress } = useGameProgressStore.getState();
    completeLevel("memory", 1);

    const progress = getProgress("memory");
    expect(progress.currentLevel).toBe(2);
    expect(progress.bestLevel).toBe(1);
    expect(progress.totalPoints).toBe(getPointsForLevel(1));
  });

  it("tracks best level independently of current level", () => {
    const { startLevel, completeLevel, getProgress } = useGameProgressStore.getState();
    startLevel("wordChallenge", 3);
    completeLevel("wordChallenge", 3);

    const progress = getProgress("wordChallenge");
    expect(progress.bestLevel).toBe(3);
    expect(progress.currentLevel).toBe(4);
  });

  it("resets a single game progress", () => {
    const { resetGame, getProgress, completeLevel } = useGameProgressStore.getState();
    completeLevel("memory", 1);
    resetGame("memory");

    expect(getProgress("memory")).toEqual({ currentLevel: 1, bestLevel: 0, totalPoints: 0 });
  });
});
