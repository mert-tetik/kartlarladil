"use client";

import { useCallback, useEffect, useState } from "react";
import { QuizContinuationMotivationView } from "@/features/quiz/components/quiz-continuation-motivation-view";
import type {
  QuizContinuationMotivation,
  QuizContinuationMotivationInput,
} from "@/features/quiz/quiz-continuation-motivations";

function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Creates a coherent result snapshot so the motivation selector can be tested in isolation. */
export function createQuizContinuationMotivationTestInput(): QuizContinuationMotivationInput {
  const answeredCount = randomInteger(6, 24);
  const incorrectCount = randomInteger(0, answeredCount);
  const chestWasMissed = Math.random() < 0.45;

  return {
    nearLearnedCount: randomInteger(0, 5),
    nearLevelUpCount: randomInteger(0, 4),
    rankProgressPercent: randomInteger(8, 98),
    pointsToNextRank: randomInteger(1, 2400),
    accuracy: Math.round(((answeredCount - incorrectCount) / answeredCount) * 100),
    incorrectCount,
    answeredCount,
    remainingActiveCards: Math.random() < 0.16 ? 0 : randomInteger(1, 32),
    gainedXp: randomInteger(0, 260),
    gainedGems: randomInteger(0, 12),
    earnedMedals: randomInteger(1, 5),
    chestWasMissed,
    chestMissedByPercentagePoints: chestWasMissed ? randomInteger(1, 15) : 0,
  };
}

export function QuizContinuationMotivationTest() {
  const [input, setInput] = useState(createQuizContinuationMotivationTestInput);
  const [isReviewQuiz, setIsReviewQuiz] = useState(false);

  const reroll = useCallback(() => {
    setInput(createQuizContinuationMotivationTestInput());
    setIsReviewQuiz((current) => !current);
  }, []);

  const logResolvedSimulation = useCallback(
    (motivations: QuizContinuationMotivation[]) => {
      console.info("[quiz-continuation-test] Simulated quiz mode", isReviewQuiz ? "learned-review" : "normal");
      console.info("[quiz-continuation-test] Simulated quiz values", input);
      console.info(
        "[quiz-continuation-test] Selected motivations",
        motivations.map(({ id, strength, values }) => ({
          id,
          strength: Number(strength.toFixed(3)),
          values,
        })),
      );
    },
    [input, isReviewQuiz],
  );

  useEffect(() => {
    console.info(
      "[quiz-continuation-test] Refresh the page or press an action to generate a new simulation.",
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      data-quiz-continuation-motivation-test
      data-review-quiz={isReviewQuiz ? "true" : "false"}
      data-remaining-active-cards={input.remainingActiveCards}
      data-chest-state={input.chestWasMissed ? "missed" : "earned"}
    >
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn={isReviewQuiz || input.remainingActiveCards > 0}
        isReviewQuiz={isReviewQuiz}
        prioritizeNextRank={!isReviewQuiz}
        onContinue={reroll}
        onExit={reroll}
        onDrawCards={reroll}
        onMotivationsResolved={logResolvedSimulation}
      />
    </div>
  );
}
