"use client";

import { useCallback, useState } from "react";
import { QuizLeaderboardProgressView } from "@/features/quiz/components/quiz-leaderboard-progress-view";
import { createQuizFlowTestLeaderboardScenario } from "@/features/quiz/quiz-leaderboard-readiness";

export function QuizLeaderboardProgressTest() {
  // Keep the scenario and keyed view in one atomic update so each replay starts fresh.
  const [loop, setLoop] = useState(() => ({
    scenario: createQuizFlowTestLeaderboardScenario(() => 0.5),
    cycle: 0,
  }));

  const replayWithNewRanks = useCallback(() => {
    setLoop((current) => ({
      scenario: createQuizFlowTestLeaderboardScenario(
        Math.random,
        current.scenario.payload.viewer.pointsPosition,
      ),
      cycle: current.cycle + 1,
    }));
  }, []);

  return (
    <main
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      data-quiz-leaderboard-test
      data-loop-cycle={loop.cycle}
    >
      <QuizLeaderboardProgressView
        key={loop.cycle}
        payload={loop.scenario.payload}
        loading={false}
        beforePosition={loop.scenario.beforePosition}
        previousViewerPoints={loop.scenario.previousViewerPoints}
        forceMotion
        onComplete={replayWithNewRanks}
      />
    </main>
  );
}
