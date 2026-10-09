"use client";

import { useCallback, useState } from "react";
import { QuizStreakCelebrationView } from "@/features/quiz/components/quiz-streak-celebration-view";
import { getQuizStreakRewardPoints } from "@/features/quiz/streak-rewards";

const TEST_STREAKS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
const TEST_GEM_REWARDS = [
  [{ type: "blue" as const, amount: 1 }],
  [{ type: "green" as const, amount: 1 }],
  [{ type: "purple" as const, amount: 1 }],
  [
    { type: "blue" as const, amount: 2 },
    { type: "green" as const, amount: 1 },
  ],
  [
    { type: "green" as const, amount: 2 },
    { type: "purple" as const, amount: 1 },
  ],
  [
    { type: "blue" as const, amount: 3 },
    { type: "purple" as const, amount: 1 },
  ],
  [
    { type: "blue" as const, amount: 3 },
    { type: "green" as const, amount: 2 },
  ],
  [
    { type: "green" as const, amount: 3 },
    { type: "purple" as const, amount: 2 },
  ],
  [
    { type: "blue" as const, amount: 4 },
    { type: "green" as const, amount: 2 },
    { type: "purple" as const, amount: 1 },
  ],
  [
    { type: "blue" as const, amount: 2 },
    { type: "green" as const, amount: 3 },
    { type: "purple" as const, amount: 3 },
  ],
];

export function StreakRewardTest() {
  const [streakIndex, setStreakIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const streak = TEST_STREAKS[streakIndex];

  const handleComplete = useCallback(() => {
    setStreakIndex((currentIndex) => (currentIndex + 1) % TEST_STREAKS.length);
    setRound((currentRound) => currentRound + 1);
    setRewardClaimed(false);
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 bg-background"
      data-streak-reward-test
      data-streak-reward-test-value={streak}
      data-streak-reward-test-points={getQuizStreakRewardPoints(streak)}
      data-streak-reward-test-claimed={rewardClaimed ? "true" : "false"}
    >
      <QuizStreakCelebrationView
        key={`${streak}-${round}`}
        streak={streak}
        onPress={() => setRewardClaimed(true)}
        rewardPoints={getQuizStreakRewardPoints(streak)}
        totalPoints={1000}
        gemRewards={TEST_GEM_REWARDS[streakIndex]}
        gemBalances={{ blue: 51, green: 31, purple: 16 }}
        onComplete={handleComplete}
      />
    </div>
  );
}
