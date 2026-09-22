"use client";

import { useCallback, useEffect, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { getStudyLocale } from "@/features/cards/card-localization";
import {
  buildDefinitionQuizQuestion,
  buildListeningQuizQuestion,
  buildQuizQuestion,
  buildSentenceCompletionQuizQuestion,
  buildTrueFalseQuizQuestion,
  isAnswerSimilarEnough,
} from "@/features/quiz/quiz-engine";
import {
  ChoiceQuestion,
  DefinitionQuestion,
  ListeningQuestion,
  MobileQuizFeedback,
  SentenceCompletionQuestion,
  TextQuestion,
  TrueFalseQuestion,
  type ChoiceQuizItem,
  type DefinitionQuizItem,
  type ListeningQuizItem,
  type NormalQuizItem,
  type SentenceCompletionQuizItem,
  type TextQuizItem,
  type TrueFalseQuizItem,
} from "@/features/quiz/components/quiz-station";
import { useLocale } from "@/i18n/locale-provider";
import type { InventoryCard, LocaleCode, VocabularyCard } from "@/types/domain";

const TEST_LANGUAGE = "en" as const;
const TEST_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function createTestInventoryCard(card: VocabularyCard): InventoryCard {
  return {
    cardId: card.id,
    status: "active",
    correctCount: 0,
    addedAt: TEST_TIMESTAMP,
  };
}

function selectRandomQuestion<T>(
  cards: VocabularyCard[],
  usedCardIds: Set<string>,
  build: (card: VocabularyCard) => T | null,
) {
  const candidates = shuffle(cards);
  const unusedCandidates = candidates.filter((card) => !usedCardIds.has(card.id));

  for (const card of [...unusedCandidates, ...candidates]) {
    const question = build(card);
    if (question !== null) {
      usedCardIds.add(card.id);
      return { card, question };
    }
  }

  return null;
}

function buildNormalTestQuestions(locale: LocaleCode): NormalQuizItem[] {
  const cards = VOCABULARY_CARDS.filter((card) => card.language === TEST_LANGUAGE);
  const usedCardIds = new Set<string>();
  const answerLocale = getStudyLocale(TEST_LANGUAGE, locale);

  if (cards.length === 0) {
    return [];
  }

  const choice = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
  );
  const listening = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildListeningQuizQuestion(card, VOCABULARY_CARDS),
  );
  const definition = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildDefinitionQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
  );
  const trueFalse = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildTrueFalseQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
  );
  const sentenceCompletion = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS),
  );
  const text = selectRandomQuestion(cards, usedCardIds, (card) => ({
    correctAnswer: card.term,
  }));
  const character = getAiPracticeCharacters()[0];

  if (!choice || !listening || !definition || !trueFalse || !sentenceCompletion || !text || !character) {
    return [];
  }

  return [
    {
      card: choice.card,
      inventoryCard: createTestInventoryCard(choice.card),
      questionType: "choice",
      question: choice.question,
      willLearn: false,
    } satisfies ChoiceQuizItem,
    {
      card: listening.card,
      inventoryCard: createTestInventoryCard(listening.card),
      questionType: "listening",
      question: listening.question,
      willLearn: false,
    } satisfies ListeningQuizItem,
    {
      card: definition.card,
      inventoryCard: createTestInventoryCard(definition.card),
      questionType: "definition",
      question: definition.question,
      willLearn: false,
    } satisfies DefinitionQuizItem,
    {
      card: trueFalse.card,
      inventoryCard: createTestInventoryCard(trueFalse.card),
      questionType: "true-false",
      question: trueFalse.question,
      willLearn: false,
    } satisfies TrueFalseQuizItem,
    {
      card: sentenceCompletion.card,
      inventoryCard: createTestInventoryCard(sentenceCompletion.card),
      questionType: "sentence-completion",
      question: sentenceCompletion.question,
      character,
      willLearn: false,
    } satisfies SentenceCompletionQuizItem,
    {
      card: text.card,
      inventoryCard: createTestInventoryCard(text.card),
      questionType: "text",
      question: text.question,
      willLearn: false,
    } satisfies TextQuizItem,
  ];
}

function getCorrectAnswer(item: NormalQuizItem) {
  return item.questionType === "true-false"
    ? item.question.actualMeaning
    : item.question.correctAnswer;
}

export function NormalQuestionsTest() {
  const { locale } = useLocale();
  const [questions, setQuestions] = useState<NormalQuizItem[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [answerAccepted, setAnswerAccepted] = useState<boolean | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [textResult, setTextResult] = useState<"idle" | "correct" | "incorrect">("idle");

  useEffect(() => {
    setQuestions(buildNormalTestQuestions(locale));
    setQuestionIndex(0);
    setShowingAnswer(false);
    setAnswerAccepted(null);
    setLastAnswer(null);
    setTextAnswer("");
    setTextResult("idle");
  }, [locale]);

  const question = questions[questionIndex] ?? null;

  const handleAnswer = useCallback((answer: string, isCorrect: boolean) => {
    setShowingAnswer(true);
    setAnswerAccepted(isCorrect);
    setLastAnswer(answer);
    setTextResult(isCorrect ? "correct" : "incorrect");
  }, []);

  const handleSkip = useCallback(() => {
    setShowingAnswer(true);
    setAnswerAccepted(false);
    setLastAnswer(null);
    setTextResult("incorrect");
  }, []);

  const handleNext = useCallback(() => {
    setQuestionIndex((currentIndex) => (currentIndex + 1) % Math.max(questions.length, 1));
    setShowingAnswer(false);
    setAnswerAccepted(null);
    setLastAnswer(null);
    setTextAnswer("");
    setTextResult("idle");
  }, [questions.length]);

  async function handleTextSubmit(answer: string) {
    handleAnswer(answer, isAnswerSimilarEnough(answer, question?.questionType === "text" ? question.question.correctAnswer : ""));
  }

  if (!question) {
    return <div className="fixed inset-0 bg-background" data-normal-test />;
  }

  const commonProps = {
    item: question as never,
    showingAnswer,
    onAnswer: handleAnswer,
    onSkip: handleSkip,
    onNext: handleNext,
    showNextButton: true,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-y-auto bg-background px-4 py-6 lg:justify-center"
      data-normal-test
      data-normal-test-kind={question.questionType}
      data-normal-test-index={questionIndex}
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-4">
        {question.questionType === "choice" ? (
          <ChoiceQuestion {...commonProps} promptClassName="max-lg:hidden" />
        ) : question.questionType === "listening" ? (
          <ListeningQuestion {...commonProps} />
        ) : question.questionType === "definition" ? (
          <DefinitionQuestion {...commonProps} isFirstQuestion />
        ) : question.questionType === "true-false" ? (
          <TrueFalseQuestion {...commonProps} promptClassName="max-lg:hidden" />
        ) : question.questionType === "sentence-completion" ? (
          <SentenceCompletionQuestion
            {...commonProps}
            isAiValidating={false}
            aiValidatingAnswer={null}
            selectedAnswer={lastAnswer}
            answerAccepted={answerAccepted}
          />
        ) : (
          <TextQuestion
            {...commonProps}
            textAnswer={textAnswer}
            textResult={textResult}
            isAiValidating={false}
            onChange={setTextAnswer}
            onSubmitText={handleTextSubmit}
            isFirstQuestion
          />
        )}
      </div>
      <MobileQuizFeedback
        isOpen={showingAnswer && answerAccepted !== null}
        isCorrect={answerAccepted ?? false}
        correctAnswer={getCorrectAnswer(question)}
        onNext={handleNext}
        showNextButton
      />
    </div>
  );
}
