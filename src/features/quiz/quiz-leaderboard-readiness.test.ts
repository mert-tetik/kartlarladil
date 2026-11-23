import { describe, expect, it } from "vitest";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import { getRankForPoints } from "@/features/progress/progress-stats";
import {
  createQuizFlowTestLeaderboardScenario,
  hasReadyQuizPointsLeaderboard,
} from "@/features/quiz/quiz-leaderboard-readiness";

const readyPayload: LeaderboardPayload = {
  mode: "points",
  viewer: {
    userId: "viewer",
    position: 2,
    pointsPosition: 2,
    streakPosition: 1,
    medalsPosition: 1,
    displayName: "Learner",
    totalPoints: 200,
    streak: 0,
    medals: 3,
    leaderboardVisible: true,
  },
  entries: [
    {
      userId: "viewer",
      position: 2,
      displayName: "Learner",
      profilePictureIndex: null,
      totalPoints: 200,
      streak: 0,
      medals: 3,
      rankIcon: "trophy",
      isViewer: true,
    },
  ],
  canViewLeaderboard: true,
};

describe("hasReadyQuizPointsLeaderboard", () => {
  it("allows the interstitial only when the ready points list shows a better rank", () => {
    expect(hasReadyQuizPointsLeaderboard(readyPayload, false, 4)).toBe(true);
  });

  it("skips when the rank did not improve or the starting rank is unknown", () => {
    expect(hasReadyQuizPointsLeaderboard(readyPayload, false, 2)).toBe(false);
    expect(hasReadyQuizPointsLeaderboard(readyPayload, false, 1)).toBe(false);
    expect(hasReadyQuizPointsLeaderboard(readyPayload, false, null)).toBe(false);
  });

  it("skips while loading, when consent hides the list, or when the viewer row is missing", () => {
    expect(hasReadyQuizPointsLeaderboard(readyPayload, true, 4)).toBe(false);
    expect(hasReadyQuizPointsLeaderboard({ ...readyPayload, canViewLeaderboard: false }, false, 4)).toBe(false);
    expect(hasReadyQuizPointsLeaderboard({ ...readyPayload, entries: [] }, false, 4)).toBe(false);
    expect(hasReadyQuizPointsLeaderboard(null, false, 4)).toBe(false);
  });
});

describe("createQuizFlowTestLeaderboardScenario", () => {
  it("creates a random-looking leaderboard scenario with a guaranteed rank improvement", () => {
    const values = [0.5, 0.5];
    const scenario = createQuizFlowTestLeaderboardScenario(() => values.shift() ?? 0);

    expect(scenario.beforePosition).toBe(76);
    expect(scenario.payload.viewer.pointsPosition).toBe(50);
    expect(scenario.payload.viewer.pointsPosition).toBeLessThan(scenario.beforePosition);
    expect(scenario.payload.entries).toHaveLength(100);
    expect(getRankForPoints(scenario.previousViewerPoints).minPoints)
      .toBeLessThan(getRankForPoints(scenario.payload.viewer.totalPoints).minPoints);
    expect(scenario.payload.entries[49]).toMatchObject({
      userId: scenario.payload.viewer.userId,
      isViewer: true,
    });
  });

  it("never repeats the previous viewer rank", () => {
    const values = [0.5, 0.5];
    const scenario = createQuizFlowTestLeaderboardScenario(() => values.shift() ?? 0, 4);

    expect(scenario.payload.viewer.pointsPosition).not.toBe(4);
    expect(scenario.payload.viewer.pointsPosition).toBeLessThan(scenario.beforePosition);
  });

  it("assigns each test row the rank icon that matches its points", () => {
    const scenario = createQuizFlowTestLeaderboardScenario(() => 0.5);

    for (const entry of scenario.payload.entries) {
      expect(entry.rankIcon).toBe(getRankForPoints(entry.totalPoints).icon);
    }
  });
});
