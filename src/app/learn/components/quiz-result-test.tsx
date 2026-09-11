"use client";

import { VOCABULARY_CARDS } from "@/data/cards";
import { ResultView } from "@/features/quiz/components/quiz-station";

const TEST_CARDS = VOCABULARY_CARDS.slice(0, 10);

export function QuizResultTest() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      data-quiz-result-test
    >
      <div className="flex h-full w-full max-w-3xl items-center justify-center">
        <ResultView
          mode="active"
          results={{
            correct: TEST_CARDS,
            incorrect: [],
            learned: TEST_CARDS.slice(0, 3),
          }}
          selectedCount={10}
          chestOpened
          locked={false}
          onRestart={() => undefined}
          onExit={() => undefined}
        />
      </div>
    </div>
  );
}
