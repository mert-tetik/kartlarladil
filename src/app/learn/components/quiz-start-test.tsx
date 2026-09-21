"use client";

import { useCallback, useState } from "react";
import { QuizStartSplash } from "@/features/quiz/components/quiz-start-splash";

export function QuizStartTest() {
  const [round, setRound] = useState(0);

  const handleComplete = useCallback(() => {
    setRound((currentRound) => currentRound + 1);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-quiz-start-test
      data-quiz-start-test-round={round}
    >
      <QuizStartSplash key={round} onComplete={handleComplete} />
    </div>
  );
}
