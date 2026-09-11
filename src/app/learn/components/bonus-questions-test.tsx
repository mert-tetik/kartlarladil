"use client";

import { useCallback, useMemo, useState } from "react";
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
  const questions = useMemo(() => buildBonusTestQuestions(locale), [locale]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [answerAccepted, setAnswerAccepted] = useState<boolean | null>(null);

  const question = questions[questionIndex] ?? null;

  const handleSubmit = useCallback((_answer: string, isCorrect: boolean) => {
    setShowingAnswer(true);
    setAnswerAccepted(isCorrect);
  }, []);

  const handleSkip = useCallback(() => {
    setShowingAnswer(true);
    setAnswerAccepted(false);
  }, []);

  const handleNext = useCallback(() => {
    setQuestionIndex((currentIndex) => (currentIndex + 1) % Math.max(questions.length, 1));
    setShowingAnswer(false);
    setAnswerAccepted(null);
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
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            onNext={handleNext}
            rewardReady={false}
            showPointFlight={false}
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
