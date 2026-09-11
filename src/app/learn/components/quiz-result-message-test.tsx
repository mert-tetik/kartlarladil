"use client";

import { useCallback, useState } from "react";
import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";

/**
 * Visual test harness for the successful quiz message shown before a reward
 * chest opens. It deliberately reuses the production celebration component.
 */
export function QuizResultMessageTest() {
  const [round, setRound] = useState(0);
  const handleComplete = useCallback(() => {
    setRound((currentRound) => currentRound + 1);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-quiz-result-message-test
      data-quiz-result-message-test-round={round}
    >
      <ChestCelebrationView key={round} onComplete={handleComplete} />
    </div>
  );
}
