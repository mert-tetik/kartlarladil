"use client";

import { useCallback, useMemo, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  buildMatchingBonusQuestion,
  type BonusQuestion,
} from "@/features/quiz/bonus-questions";
import { BonusQuestionView } from "@/features/quiz/components/bonus-question-view";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import type { GemBalances, GemType } from "@/features/gems/gem-types";
import type { GemHudPulse } from "@/features/progress/components/reward-gem-hud";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale } from "@/i18n/locale-provider";

const TEST_LANGUAGE = "en" as const;
const TEST_GEM_REWARDS = [
  { type: "blue" as const, amount: 2 },
  { type: "green" as const, amount: 1 },
  { type: "purple" as const, amount: 1 },
];

export function BonusRewardTest() {
  const { locale } = useLocale();
  const { stats } = useProgressStats();
  const session = useOptionalAuthSession();
  const [round, setRound] = useState(0);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [gemBalances, setGemBalances] = useState<GemBalances | null>(null);
  const [gemPulse, setGemPulse] = useState<GemHudPulse | null>(null);
  const [scorePulse, setScorePulse] = useState(0);

  const question = useMemo<BonusQuestion | null>(() => {
    const languageCards = VOCABULARY_CARDS.filter((card) => card.language === TEST_LANGUAGE);
    return buildMatchingBonusQuestion(languageCards, locale, "bonus-reward-test");
  }, [locale]);

  const profileGemBalances = useMemo<GemBalances>(
    () => ({
      blue: session?.user?.profile.blueGems ?? 0,
      green: session?.user?.profile.greenGems ?? 0,
      purple: session?.user?.profile.purpleGems ?? 0,
    }),
    [
      session?.user?.profile.blueGems,
      session?.user?.profile.greenGems,
      session?.user?.profile.purpleGems,
    ],
  );

  const handleGemArrive = useCallback(
    (type: GemType) => {
      setGemBalances((current) => {
        const base = current ?? profileGemBalances;
        return { ...base, [type]: base[type] + 1 };
      });
      setGemPulse((current) => ({ type, key: (current?.key ?? 0) + 1 }));
    },
    [profileGemBalances],
  );

  const handleRewardComplete = useCallback(() => {
    setBonusPoints(0);
    setGemPulse(null);
    setRound((current) => current + 1);
  }, []);

  if (!question) {
    return <div className="fixed inset-0 bg-background" data-bonus-reward-test />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-0 items-center justify-center overflow-hidden bg-background"
      data-bonus-reward-test
      data-bonus-reward-test-round={round}
    >
      <BonusQuestionView
        key={`${question.kind}-${round}`}
        question={question}
        showingAnswer
        answerAccepted
        onSubmit={() => undefined}
        onSkip={() => undefined}
        onNext={() => undefined}
        rewardReady
        showPointFlight
        totalPoints={stats.totalPoints + bonusPoints}
        scorePulse={scorePulse}
        gemBalances={gemBalances ?? profileGemBalances}
        gemPulse={gemPulse}
        gemRewards={TEST_GEM_REWARDS}
        rewardRevealVisible
        onPointArrive={(points) => {
          setBonusPoints((current) => Math.max(current, points));
          setScorePulse((current) => current + 1);
        }}
        onGemArrive={handleGemArrive}
        onGemFlightComplete={handleRewardComplete}
      />
    </div>
  );
}
