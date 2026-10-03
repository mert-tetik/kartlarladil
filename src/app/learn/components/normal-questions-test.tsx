"use client";

import { useCallback, useEffect, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
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
import { buildGroupQuestion } from "@/features/quiz/group-question";
import {
  ChoiceQuestion,
  DefinitionQuestion,
  GroupQuestion,
  ListeningQuestion,
  MobileQuizFeedback,
  MobileQuizTopBar,
  SentenceCompletionQuestion,
  TextQuestion,
  TrueFalseQuestion,
  type ChoiceQuizItem,
  type DefinitionQuizItem,
  type GroupQuizItem,
  type ListeningQuizItem,
  type NormalQuizItem,
  type SentenceCompletionQuizItem,
  type TextQuizItem,
  type TrueFalseQuizItem,
} from "@/features/quiz/components/quiz-station";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
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
  const group = selectRandomQuestion(cards, usedCardIds, (card) =>
    buildGroupQuestion(card),
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

  if (!choice || !listening || !definition || !group || !trueFalse || !sentenceCompletion || !text || !character) {
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
      card: group.card,
      inventoryCard: createTestInventoryCard(group.card),
      questionType: "group",
      question: group.question,
      character,
      willLearn: false,
    } satisfies GroupQuizItem,
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
  if (item.questionType === "true-false") {
    return item.question.actualMeaning;
  }

  if (item.questionType === "group") {
    return item.question.options.find(
      (option) => option.card.id === item.question.correctOptionId,
    )?.card.term ?? item.card.term;
  }

  return item.question.correctAnswer;
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
    rerollAction: {
      onReroll: () => undefined,
      disabled: true,
      loading: false,
    },
    onNext: handleNext,
    showNextButton: true,
  };
  const isCardFirstQuestion =
    question.questionType === "choice" ||
    question.questionType === "listening" ||
    question.questionType === "true-false" ||
    question.questionType === "group";
  const isDefinitionQuestion = question.questionType === "definition";
  const isSentenceCompletionQuestion = question.questionType === "sentence-completion";
  const card = (
    <div className="relative aspect-[3/4] w-[min(285px,calc((100vw-3rem)/2))] max-w-full shrink-0">
      <VocabularyCardView
        card={question.card}
        inventory={question.inventoryCard}
        owned
        initialFace="back"
        face={showingAnswer ? "front" : "back"}
        flippable={false}
        footerMode="empty"
        className="h-full w-full min-h-0 max-sm:min-h-0"
      />
    </div>
  );
  const compactCard = (
    <div className="origin-bottom scale-[0.78]">{card}</div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-y-auto bg-background px-4 py-6 max-lg:pt-20 lg:justify-center"
      data-normal-test
      data-learn-quiz-page="quiz"
      data-normal-test-kind={question.questionType}
      data-normal-test-index={questionIndex}
    >
      <MobileQuizTopBar
        currentIndex={questionIndex}
        total={Math.max(questions.length, 1)}
        totalPoints={0}
        scorePulse={0}
        questionPrompt={null}
        onExit={() => undefined}
      />
      <div
        className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center gap-3 py-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:py-0"
        data-quiz-mobile-layout={question.questionType}
      >
        <div
          className={cn(
            "flex w-full max-w-md flex-col justify-center gap-3 lg:order-1 lg:col-start-1 lg:row-start-1 lg:max-w-none lg:gap-4",
            isCardFirstQuestion ? "order-3 max-lg:pb-3" : "order-1",
          )}
          data-quiz-mobile-question
        >
          <div className="flex flex-1 flex-col justify-center">
            {question.questionType === "choice" ? (
              <ChoiceQuestion {...commonProps} promptClassName="max-lg:hidden" />
            ) : question.questionType === "listening" ? (
              <ListeningQuestion {...commonProps} />
            ) : question.questionType === "definition" ? (
              <DefinitionQuestion {...commonProps} isFirstQuestion />
            ) : question.questionType === "group" ? (
              <GroupQuestion {...commonProps} selectedAnswer={lastAnswer} />
            ) : question.questionType === "true-false" ? (
              <TrueFalseQuestion {...commonProps} promptClassName="max-lg:hidden" />
            ) : question.questionType === "sentence-completion" ? (
              <SentenceCompletionQuestion
                {...commonProps}
                isAiValidating={false}
                aiValidatingAnswer={null}
                selectedAnswer={lastAnswer}
                answerAccepted={answerAccepted}
                mobileCard={compactCard}
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
        </div>

        {!isDefinitionQuestion && !isSentenceCompletionQuestion ? (
          <div className="order-2 flex items-center justify-center lg:hidden" data-quiz-mobile-card-slot>
            {card}
          </div>
        ) : null}

        <div className="hidden h-[440px] items-center justify-center lg:order-2 lg:col-start-2 lg:row-start-1 lg:flex">
          <div className="relative h-[440px] w-auto transform-gpu">
            <VocabularyCardView
              card={question.card}
              inventory={question.inventoryCard}
              owned
              initialFace="back"
              face={showingAnswer ? "front" : "back"}
              flippable={false}
              footerMode="empty"
              className="h-full w-auto min-h-0 max-w-full"
            />
          </div>
        </div>
      </div>
      <MobileQuizFeedback
        isOpen={showingAnswer && answerAccepted !== null}
        isCorrect={answerAccepted ?? false}
        forceMascotAnimation
        correctAnswer={getCorrectAnswer(question)}
        onNext={handleNext}
        showNextButton
      />
    </div>
  );
}
