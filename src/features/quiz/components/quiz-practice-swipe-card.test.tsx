import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { QuizPracticeSwipeCard } from "@/features/quiz/components/quiz-practice-swipe-card";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: () => <div data-testid="vocabulary-card-front" />,
}));

const askOverlayMock = vi.hoisted(() => ({ openAsk: vi.fn() }));

vi.mock("@/features/cards/components/card-grammar-details-overlay", () => ({
  CardGrammarDetailsButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" data-card-grammar-details-button onClick={onClick}>
      Grammar details
    </button>
  ),
  CardGrammarDetailsOverlay: ({ open }: { open: boolean }) => (
    <div data-testid="grammar-overlay" data-open={open} />
  ),
}));

vi.mock("@/features/ask/components/ask-overlay-provider", () => ({
  useAskOverlay: () => askOverlayMock,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => unknown) => action(),
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
    const progressFeedback = document.querySelector("[data-swipe-card-feedback]");
    expect(progressFeedback).toHaveClass("bg-emerald-500/85");
    expect(progressFeedback?.querySelector("svg")).toHaveClass("size-24", "stroke-[3.5]");
    expect(progressFeedback?.querySelector("svg")?.parentElement).toBe(progressFeedback);
    expect(document.querySelector("[data-swipe-card-feedback-label]")).toHaveClass("left-5", "top-5");
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
    expect(document.querySelector("[data-swipe-card-feedback]"))
      .toHaveClass("bg-sky-600/85");
  });

  it("shows the appropriate localized prompt and status badge", () => {
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <QuizPracticeSwipeCard item={makeItem()} onSwipe={vi.fn()} />
      </LocaleProvider>,
    );

    expect(document.querySelector('[data-quiz-practice-prompt="progress"]'))
      .toHaveTextContent("Swipe right if you know this card");
    expect(document.querySelector("[data-quiz-practice-prompt-text]")).toHaveClass("font-super-water");
    expect(document.querySelector('[data-quiz-practice-prompt-badge]'))
      .toHaveAttribute("src", expect.stringContaining("kart_ogreniliyor_madalyasi.webp"));

    rerender(
      <LocaleProvider initialLocale="en">
        <QuizPracticeSwipeCard item={makeItem(true)} onSwipe={vi.fn()} />
      </LocaleProvider>,
    );

    expect(document.querySelector('[data-quiz-practice-prompt="learned"]'))
      .toHaveTextContent("Swipe right if you have learned this card");
    expect(document.querySelector('[data-quiz-practice-prompt-badge]'))
      .toHaveAttribute("src", expect.stringContaining("kart_ogrenildi_madalyasi.webp"));
  });

  it("keeps the grammar and Ask actions attached to the card without treating button taps as swipes", () => {
    const onSwipe = vi.fn();
    const { card: cardElement } = renderSwipeCard(makeItem(), onSwipe);
    const actions = document.querySelector<HTMLElement>("[data-quiz-practice-card-actions]")!;
    const grammarButton = screen.getByRole("button", { name: "Grammar details" });
    const askButton = screen.getByRole("button", { name: "Ask" });

    expect(actions).toHaveClass("mt-[13px]", "gap-[13px]");
    fireEvent.click(grammarButton);
    expect(screen.getByTestId("grammar-overlay")).toHaveAttribute("data-open", "true");

    fireEvent.pointerDown(askButton, {
      pointerId: 4,
      isPrimary: true,
      button: 0,
      clientX: 30,
      clientY: 40,
    });
    fireEvent.pointerMove(cardElement, {
      pointerId: 4,
      clientX: 180,
      clientY: 40,
    });
    fireEvent.pointerUp(cardElement, {
      pointerId: 4,
      clientX: 180,
      clientY: 40,
    });
    fireEvent.click(askButton);

    expect(askOverlayMock.openAsk).toHaveBeenCalledWith({
      contextLanguage: card.language,
      initialTerm: card.term,
    });
    expect(onSwipe).not.toHaveBeenCalled();
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
