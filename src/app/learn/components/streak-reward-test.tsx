"use client";

import { useCallback, useState } from "react";
import { QuizStreakRewardView } from "@/features/quiz/components/quiz-streak-reward-view";
import { getQuizStreakRewardPoints } from "@/features/quiz/streak-rewards";
import type { GemRewards } from "@/features/gems/gem-types";

const TEST_STREAKS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
const TEST_GEM_REWARDS: GemRewards[] = [
  [{ type: "blue", amount: 1 }],
  [{ type: "green", amount: 1 }],
  [{ type: "purple", amount: 1 }],
  [
    { type: "blue", amount: 2 },
    { type: "green", amount: 1 },
  ],
  [
    { type: "green", amount: 2 },
    { type: "purple", amount: 1 },
  ],
  [
    { type: "blue", amount: 3 },
    { type: "purple", amount: 1 },
  ],
  [
    { type: "blue", amount: 3 },
    { type: "green", amount: 2 },
  ],
  [
    { type: "green", amount: 3 },
    { type: "purple", amount: 2 },
  ],
  [
    { type: "blue", amount: 4 },
    { type: "green", amount: 2 },
    { type: "purple", amount: 1 },
  ],
  [
    { type: "blue", amount: 2 },
    { type: "green", amount: 3 },
    { type: "purple", amount: 3 },
  ],
];

const TEST_GEM_BALANCES = { blue: 50, green: 30, purple: 15 } as const;

export function StreakRewardTest() {
  const [streakIndex, setStreakIndex] = useState(0);
  const [round, setRound] = useState(0);
  const streak = TEST_STREAKS[streakIndex];

  const handleComplete = useCallback(() => {
    setStreakIndex((currentIndex) => (currentIndex + 1) % TEST_STREAKS.length);
    setRound((currentRound) => currentRound + 1);
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 bg-background"
      data-streak-reward-test
      data-streak-reward-test-value={streak}
      data-streak-reward-test-points={getQuizStreakRewardPoints(streak)}
    >
      <QuizStreakRewardView
        key={`${streak}-${round}`}
        streak={streak}
        points={getQuizStreakRewardPoints(streak)}
        totalPoints={1000}
        testMode
        testGemRewards={TEST_GEM_REWARDS[streakIndex]}
        testGemBalances={TEST_GEM_BALANCES}
        onComplete={handleComplete}
      />
    </div>
  );
}
