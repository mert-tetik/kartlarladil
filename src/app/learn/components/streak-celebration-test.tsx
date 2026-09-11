"use client";

import { useCallback, useState } from "react";
import { QuizStreakCelebrationView } from "@/features/quiz/components/quiz-streak-celebration-view";

const TEST_STREAKS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export function StreakCelebrationTest() {
  const [streakIndex, setStreakIndex] = useState(0);
  const [round, setRound] = useState(0);
  const streak = TEST_STREAKS[streakIndex];

  const handleComplete = useCallback(() => {
    setStreakIndex((currentIndex) => (currentIndex + 1) % TEST_STREAKS.length);
    setRound((currentRound) => currentRound + 1);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-streak-test
      data-streak-test-value={streak}
    >
      <QuizStreakCelebrationView
        key={`${streak}-${round}`}
        streak={streak}
        onComplete={handleComplete}
      />
    </div>
  );
}
