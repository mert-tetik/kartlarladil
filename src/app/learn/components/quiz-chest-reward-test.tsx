"use client";

import { useCallback, useEffect, useState } from "react";
import { createChestRewardPreview } from "@/features/gems/chest-reward-preview";
import { QuizChestRewardGate } from "@/features/quiz/components/quiz-chest-reward-gate";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";

const TEST_ACCURACY = 69;
const TEST_REQUIRED_ACCURACY = 70;
const TEST_CHEST_DELAY_MS = 1000;
const TEST_IRON_CHEST = CHEST_TIERS.find((tier) => tier.tier === "iron") ?? CHEST_TIERS[0]!;

/**
 * Standalone visual harness for the post-result chest screen.
 * Each completion alternates between an iron chest and a missed chest.
 */
export function QuizChestRewardTest() {
  const t = useT();
  const { locale } = useLocale();
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const hasChest = round % 2 === 0;
  const requiredAccuracy = formatNumber(locale, TEST_REQUIRED_ACCURACY);
  const accuracy = formatNumber(locale, TEST_ACCURACY);

  const handleComplete = useCallback(() => {
    setReady(false);
    setRound((currentRound) => currentRound + 1);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setReady(true), TEST_CHEST_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [round]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-quiz-chest-reward-test
      data-quiz-chest-reward-test-round={round}
      data-quiz-chest-reward-test-state={hasChest ? "earned" : "missed"}
    >
      {ready ? (
        <QuizChestRewardGate
          key={round}
          tier={hasChest ? TEST_IRON_CHEST : null}
          totalPoints={0}
          accuracy={TEST_ACCURACY}
          missedReason={t("chest.missedReason", { required: requiredAccuracy })}
        missedProgress={t("chest.missedProgress", { accuracy })}
          onComplete={handleComplete}
          onRewardReady={hasChest
            ? () => Promise.resolve(createChestRewardPreview("iron"))
            : undefined}
        />
      ) : null}
    </div>
  );
}
