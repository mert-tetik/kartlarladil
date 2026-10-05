"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { createChestRewardPreview } from "@/features/gems/chest-reward-preview";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { ResultFlowView } from "@/features/quiz/components/quiz-station";

const TEST_CARDS = VOCABULARY_CARDS.slice(0, 10);
const RESULT_TEST_LEARNED_CARDS = VOCABULARY_CARDS.slice(0, 14);
const RESULT_TEST_ADVANCED_CARDS = VOCABULARY_CARDS.slice(14, 28);
const RESULT_TEST_REOPEN_DELAY_MS = 1000;
const RESULT_TEST_IRON_CHEST = CHEST_TIERS.find((tier) => tier.tier === "iron") ?? CHEST_TIERS[0]!;

export function QuizResultTest() {
  const [round, setRound] = useState(0);
  const [visible, setVisible] = useState(true);
  const reopenTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (reopenTimerRef.current !== null) {
        window.clearTimeout(reopenTimerRef.current);
      }
    };
  }, []);

  const handleContinue = useCallback(() => {
    if (reopenTimerRef.current !== null) return;

    setVisible(false);
    reopenTimerRef.current = window.setTimeout(() => {
      reopenTimerRef.current = null;
      setRound((currentRound) => currentRound + 1);
      setVisible(true);
    }, RESULT_TEST_REOPEN_DELAY_MS);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      data-quiz-result-test
      data-quiz-result-test-round={round}
      data-quiz-result-test-state={visible ? "visible" : "closed"}
    >
      {visible ? (
        <div key={round} className="flex h-full w-full max-w-3xl items-center justify-center">
          <ResultFlowView
            mode="active"
            results={{
              correct: TEST_CARDS,
              incorrect: [],
              learned: TEST_CARDS.slice(0, 3),
            }}
            selectedCount={10}
            quizDurationSeconds={113}
            chestOpened
            showChestRewardGate
            chestTier={round % 2 === 0 ? RESULT_TEST_IRON_CHEST : null}
            chestTotalPoints={0}
            onChestRewardReady={round % 2 === 0
              ? () => Promise.resolve(createChestRewardPreview("iron"))
              : undefined}
            locked={false}
            showResultMessage
            learnedCards={RESULT_TEST_LEARNED_CARDS}
            advancedCards={RESULT_TEST_ADVANCED_CARDS}
            currentRankIcon="medal"
            nextRankIcon="book"
            onContinue={handleContinue}
            onRestart={handleContinue}
            onExit={() => undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
