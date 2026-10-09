"use client";

import { useCallback, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { QuizResultMessageView } from "@/features/quiz/components/quiz-result-message-view";

/**
 * Visual test harness for the result message cards shown before the reward
 * flow. It deliberately reuses the production result-message component.
 */
export function QuizResultMessageTest() {
  const [round, setRound] = useState(0);
  const learnedCards = VOCABULARY_CARDS.slice(0, 10);
  const advancedCards = VOCABULARY_CARDS.slice(10, 20);
  const handleComplete = useCallback(() => {
    setRound((currentRound) => currentRound + 1);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-quiz-result-message-test
      data-quiz-result-message-test-round={round}
    >
      <QuizResultMessageView
        key={round}
        learnedCards={learnedCards}
        advancedCards={advancedCards}
        onComplete={handleComplete}
      />
    </div>
  );
}
