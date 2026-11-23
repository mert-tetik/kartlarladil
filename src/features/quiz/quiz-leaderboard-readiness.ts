import type { LeaderboardEntry, LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import { getRankForPoints } from "@/features/progress/progress-stats";

const QUIZ_FLOW_TEST_LEADERBOARD_SIZE = 100;

export function hasReadyQuizPointsLeaderboard(
  payload: LeaderboardPayload | null,
  loading: boolean,
  beforePosition: number | null,
): payload is LeaderboardPayload {
  if (
    loading ||
    payload?.mode !== "points" ||
    !payload.canViewLeaderboard ||
    !Number.isFinite(payload.viewer.pointsPosition) ||
    typeof beforePosition !== "number" ||
    !Number.isFinite(beforePosition) ||
    payload.viewer.pointsPosition >= beforePosition
  ) {
    return false;
  }

  return payload.entries.some(
    (entry) => entry.isViewer || entry.userId === payload.viewer.userId,
  );
}

export interface QuizFlowTestLeaderboardScenario {
  payload: LeaderboardPayload;
  beforePosition: number;
  previousViewerPoints: number;
}

export function createQuizFlowTestLeaderboardScenario(
  random: () => number = Math.random,
  previousPosition: number | null = null,
): QuizFlowTestLeaderboardScenario {
  const availablePositions = Array.from(
    { length: QUIZ_FLOW_TEST_LEADERBOARD_SIZE - 1 },
    (_, index) => index + 1,
  )
    .filter((position) => position !== previousPosition);
  const currentPosition = availablePositions[randomInteger(0, availablePositions.length - 1, random)];
  const beforePosition = randomInteger(currentPosition + 1, QUIZ_FLOW_TEST_LEADERBOARD_SIZE, random);
  const viewerId = "quiz-flow-test-viewer";
  const entries: LeaderboardEntry[] = Array.from({ length: QUIZ_FLOW_TEST_LEADERBOARD_SIZE }, (_, index) => {
    const position = index + 1;
    const isViewer = position === currentPosition;
    const totalPoints = (QUIZ_FLOW_TEST_LEADERBOARD_SIZE + 1 - position) * 500;

    return {
      userId: isViewer ? viewerId : `quiz-flow-test-player-${position}`,
      position,
      displayName: isViewer ? "You" : `Player ${position}`,
      profilePictureIndex: null,
      totalPoints,
      streak: 0,
      medals: 0,
      rankIcon: getRankForPoints(totalPoints).icon,
      isViewer,
    };
  });
  const viewerTotalPoints = (QUIZ_FLOW_TEST_LEADERBOARD_SIZE + 1 - currentPosition) * 500;
  const previousViewerPoints = Math.max(0, getRankForPoints(viewerTotalPoints).minPoints - 1);

  return {
    beforePosition,
    previousViewerPoints,
    payload: {
      mode: "points",
      viewer: {
        userId: viewerId,
        position: currentPosition,
        pointsPosition: currentPosition,
        streakPosition: currentPosition,
        medalsPosition: currentPosition,
        displayName: "You",
        totalPoints: viewerTotalPoints,
        streak: 0,
        medals: 0,
        leaderboardVisible: true,
      },
      entries,
      canViewLeaderboard: true,
    },
  };
}

function randomInteger(min: number, max: number, random: () => number) {
  const value = Math.min(0.999999999, Math.max(0, random()));
  return min + Math.floor(value * (max - min + 1));
}
