"use client";

import { useCallback, useEffect, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  buildFallbackCategoryBonusQuestion,
  buildFallbackSentenceOrderQuestion,
  buildImposterBonusQuestion,
  buildMatchingBonusQuestion,
  type BonusQuestion,
} from "@/features/quiz/bonus-questions";
import {
  BonusQuestionIntro,
  BonusQuestionView,
} from "@/features/quiz/components/bonus-question-view";
import { MobileQuizFeedback } from "@/features/quiz/components/quiz-station";
import { useLocale } from "@/i18n/locale-provider";
import { useProgressStats } from "@/features/progress/progress-client";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import type { GemBalances } from "@/features/gems/gem-types";
import type { GemHudPulse } from "@/features/progress/components/reward-gem-hud";

const TEST_LANGUAGE = "en" as const;

function buildBonusTestQuestions(locale: Parameters<typeof buildMatchingBonusQuestion>[1]): BonusQuestion[] {
  const languageCards = VOCABULARY_CARDS.filter((card) => card.language === TEST_LANGUAGE);
  const questions = [
    buildMatchingBonusQuestion(languageCards, locale, "bonus-test-matching"),
    buildFallbackSentenceOrderQuestion(languageCards, "bonus-test-sentence"),
    buildFallbackCategoryBonusQuestion(TEST_LANGUAGE, "bonus-test-category"),
    buildImposterBonusQuestion(TEST_LANGUAGE, "bonus-test-imposter"),
  ];

  return questions.filter((question): question is BonusQuestion => question !== null);
}

export function BonusQuestionsTest() {
  const { locale } = useLocale();
  const { stats } = useProgressStats();
  const session = useOptionalAuthSession();
  const [questions, setQuestions] = useState<BonusQuestion[]>([]);
  useEffect(() => {
    setQuestions(buildBonusTestQuestions(locale));
  }, [locale]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [answerAccepted, setAnswerAccepted] = useState<boolean | null>(null);
  const [wasSkipped, setWasSkipped] = useState(false);
  const [testBonusPoints, setTestBonusPoints] = useState(0);
  const [testGemBalances, setTestGemBalances] = useState<GemBalances | null>(null);
  const [testGemPulse, setTestGemPulse] = useState<GemHudPulse | null>(null);
  const profileGemBalances: GemBalances = {
    blue: session?.user?.profile.blueGems ?? 0,
    green: session?.user?.profile.greenGems ?? 0,
    purple: session?.user?.profile.purpleGems ?? 0,
  };

  const question = questions[questionIndex] ?? null;
  const rewardAnimationActive = showingAnswer && answerAccepted === true;

  const handleSubmit = useCallback((_answer: string, isCorrect: boolean) => {
    setShowingAnswer(true);
    setAnswerAccepted(isCorrect);
    setWasSkipped(false);
    if (isCorrect) {
      setTestBonusPoints(0);
    }
  }, []);

  const handleSkip = useCallback(() => {
    setShowingAnswer(true);
    setAnswerAccepted(false);
    setWasSkipped(true);
  }, []);

  const handleNext = useCallback(() => {
    setQuestionIndex((currentIndex) => (currentIndex + 1) % Math.max(questions.length, 1));
    setShowingAnswer(false);
    setAnswerAccepted(null);
    setWasSkipped(false);
    setTestBonusPoints(0);
    setTestGemPulse(null);
    setShowIntro(true);
  }, [questions.length]);

  if (!question) {
    return <div className="fixed inset-0 bg-background" data-bonus-test />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-y-auto bg-background px-4 py-6 lg:justify-center"
      data-bonus-test
      data-bonus-test-kind={question.kind}
      data-bonus-test-index={questionIndex}
    >
      {showIntro ? <BonusQuestionIntro onComplete={() => setShowIntro(false)} /> : null}
      {!showIntro ? (
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-4">
          <BonusQuestionView
            key={`${question.kind}-${questionIndex}`}
            question={question}
            showingAnswer={showingAnswer}
            answerAccepted={answerAccepted}
            wasSkipped={wasSkipped}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            onNext={handleNext}
            rewardReady={rewardAnimationActive}
            showPointFlight={rewardAnimationActive}
            totalPoints={stats.totalPoints + testBonusPoints}
            gemRewards={rewardAnimationActive ? [
              { type: "blue", amount: 2 },
              { type: "green", amount: 1 },
              { type: "purple", amount: 1 },
            ] : []}
            gemBalances={testGemBalances ?? profileGemBalances}
            gemPulse={testGemPulse}
            onPointArrive={(points) => {
              setTestBonusPoints((current) => Math.max(current, points));
            }}
            onGemArrive={(type) => {
              setTestGemBalances((current) => {
                const base = current ?? profileGemBalances;
                return { ...base, [type]: base[type] + 1 };
              });
              setTestGemPulse((current) => ({
                type,
                key: (current?.key ?? 0) + 1,
              }));
            }}
          />
        </div>
      ) : null}
      <MobileQuizFeedback
        isOpen={!showIntro && showingAnswer && answerAccepted !== null}
        isCorrect={answerAccepted ?? false}
        onNext={handleNext}
        showNextButton
      />
    </div>
  );
}
