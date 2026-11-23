import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { QuizPracticeSwipeCard } from "@/features/quiz/components/quiz-practice-swipe-card";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: () => <div data-testid="vocabulary-card-front" />,
}));

const card = VOCABULARY_CARDS.find((entry) => entry.language === "en")!;
const makeItem = (willLearn = false): NormalQuizItem => ({
  card,
  inventoryCard: {
    cardId: card.id,
    status: "active",
    correctCount: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
  },
  willLearn,
  questionType: "text",
  question: { correctAnswer: card.term },
});

function renderSwipeCard(item = makeItem(), onSwipe = vi.fn()) {
  render(
    <LocaleProvider initialLocale="en">
      <QuizPracticeSwipeCard item={item} onSwipe={onSwipe} />
    </LocaleProvider>,
  );
  return {
    card: screen.getByRole("group", { name: new RegExp(card.term) }),
    onSwipe,
  };
}

describe("QuizPracticeSwipeCard", () => {
  afterEach(() => vi.useRealTimers());

  it("marks a known card as understood when swiped right", () => {
    vi.useFakeTimers();
    const onSwipe = vi.fn();
    const { card: cardElement } = renderSwipeCard(makeItem(), onSwipe);

    expect(document.querySelector("[data-quiz-practice-card-deal]"))
      .toHaveClass("card-draw-card-deal");

    fireEvent.pointerDown(cardElement, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.pointerMove(cardElement, { pointerId: 1, clientX: 130, clientY: 20 });
    expect(screen.getByText("Understood")).toBeInTheDocument();
    fireEvent.pointerUp(cardElement, { pointerId: 1, clientX: 130, clientY: 20 });
    fireEvent.keyDown(cardElement, { key: "ArrowLeft" });

    expect(screen.getByRole("status")).toHaveTextContent("Understood");
    act(() => vi.advanceTimersByTime(300));
    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });

  it("uses the learned label for a right swipe that will complete the card", () => {
    const { card: cardElement } = renderSwipeCard(makeItem(true));

    fireEvent.pointerDown(cardElement, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.pointerMove(cardElement, { pointerId: 1, clientX: 130, clientY: 20 });

    expect(screen.getByText("I learned it")).toBeInTheDocument();
  });

  it("records a left swipe as incorrect", () => {
    vi.useFakeTimers();
    const onSwipe = vi.fn();
    const { card: cardElement } = renderSwipeCard(makeItem(), onSwipe);

    fireEvent.keyDown(cardElement, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(300));

    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });
});
