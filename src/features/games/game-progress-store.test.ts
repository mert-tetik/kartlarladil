import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameProgressStore } from "./game-progress-store";
import { getPointsForLevel } from "./game-levels";
import { markPlayReviewEligible } from "@/features/reviews/play-review-eligibility";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: vi.fn(),
}));

vi.mock("@/features/reviews/play-review-eligibility", () => ({
  markPlayReviewEligible: vi.fn(),
}));

vi.mock("@/features/missions/mission-sync", () => ({
  syncMissionsFromClientState: vi.fn(async () => {}),
}));

describe("useGameProgressStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameProgressStore.setState({
      progress: {
        memory: { currentLevel: 1, bestLevel: 0, totalPoints: 0 },
        wordChallenge: { currentLevel: 1, bestLevel: 0, totalPoints: 0 },
        wordMatch: { currentLevel: 1, bestLevel: 0, totalPoints: 0 },
      },
      selectedLanguage: "all",
    });
  });

  it("starts with level 1 and zero points", () => {
    const state = useGameProgressStore.getState();
    expect(state.getProgress("memory")).toEqual({ currentLevel: 1, bestLevel: 0, totalPoints: 0 });
    expect(state.getProgress("wordMatch")).toEqual({ currentLevel: 1, bestLevel: 0, totalPoints: 0 });
  });

  it("unlocks the next level and awards points on completion", () => {
    const { completeLevel, getProgress } = useGameProgressStore.getState();
    completeLevel("memory", 1);

    const progress = getProgress("memory");
    expect(progress.currentLevel).toBe(2);
    expect(progress.bestLevel).toBe(1);
    expect(progress.totalPoints).toBe(getPointsForLevel(1));
    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_game_level_up", {
      params: {
        game_name: "memory",
        level: 1,
        next_level: 2,
        best_level: 1,
        game_points: getPointsForLevel(1),
      },
    });
    expect(markPlayReviewEligible).toHaveBeenCalledWith("game");
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

  it("does not log another level-up event when replaying an already cleared level", () => {
    const { completeLevel } = useGameProgressStore.getState();

    completeLevel("memory", 1);
    vi.clearAllMocks();

    completeLevel("memory", 1);

    expect(sendTwaAnalyticsEvent).not.toHaveBeenCalled();
    expect(markPlayReviewEligible).toHaveBeenCalledWith("game");
  });
});
