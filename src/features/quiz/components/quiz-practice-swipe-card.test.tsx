import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  getEasyPracticePromptSide,
  QuizPracticeSwipeCard,
} from "@/features/quiz/components/quiz-practice-swipe-card";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";

vi.mock("@/features/cards/card-speech", () => ({ speakCardTerm: vi.fn() }));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ face }: { face: "front" | "back" }) => (
    <div data-testid="vocabulary-card" data-card-face={face} />
  ),
}));

const askOverlayMock = vi.hoisted(() => ({ openAsk: vi.fn() }));

vi.mock("@/features/cards/components/card-grammar-details-overlay", () => ({
  CardGrammarDetailsButton: ({
    onClick,
    showIcon,
    className,
  }: { onClick: () => void; showIcon?: boolean; className?: string }) => (
    <button
      type="button"
      data-card-grammar-details-button
      data-show-icon={showIcon !== false}
      className={className}
      onClick={onClick}
    >
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
const makeItem = (willLearn = false, itemCard = card): NormalQuizItem => ({
  card: itemCard,
  inventoryCard: {
    cardId: itemCard.id,
    status: "active",
    correctCount: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
  },
  willLearn,
  questionType: "text",
  question: { correctAnswer: itemCard.term },
});

function renderSwipeCard(item = makeItem(), onSwipe = vi.fn(), onReveal = vi.fn()) {
  render(
    <LocaleProvider initialLocale="en">
      <QuizPracticeSwipeCard item={item} onReveal={onReveal} onSwipe={onSwipe} />
    </LocaleProvider>,
  );
  return {
    card: document.querySelector<HTMLElement>("[data-quiz-practice-swipe-card]")!,
    onSwipe,
    onReveal,
  };
}

describe("QuizPracticeSwipeCard", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the card face down and blocks swipes until it is tapped", () => {
    vi.useFakeTimers();
    const onSwipe = vi.fn();
    const { card: cardElement } = renderSwipeCard(makeItem(), onSwipe);

    expect(cardElement).toHaveAttribute("data-quiz-practice-card-revealed", "false");
    expect(screen.getByTestId("vocabulary-card")).toHaveAttribute("data-card-face", "back");
    expect(screen.queryByRole("button", { name: "Grammar details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask" })).not.toBeInTheDocument();

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
    fireEvent.pointerUp(cardElement, { pointerId: 1, clientX: 130, clientY: 20 });
    fireEvent.click(cardElement);
    expect(cardElement).toHaveAttribute("data-quiz-practice-card-revealed", "false");
    fireEvent.keyDown(cardElement, { key: "ArrowRight" });
    expect(onSwipe).not.toHaveBeenCalled();

    fireEvent.click(cardElement);
    expect(cardElement).toHaveAttribute("data-quiz-practice-card-revealed", "true");
    expect(screen.getByTestId("vocabulary-card")).toHaveAttribute("data-card-face", "front");

    fireEvent.pointerDown(cardElement, {
      pointerId: 2,
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.pointerMove(cardElement, { pointerId: 2, clientX: 130, clientY: 20 });
    expect(screen.getByText("Understood")).toBeInTheDocument();
    const progressFeedback = document.querySelector("[data-swipe-card-feedback]");
    expect(progressFeedback).toHaveClass("bg-emerald-500/85");
    expect(progressFeedback?.querySelector("svg")).toHaveClass("size-24", "stroke-[3.5]");
    expect(progressFeedback?.querySelector("svg")?.parentElement).toBe(progressFeedback);
    expect(document.querySelector("[data-swipe-card-feedback-label]")).toHaveClass("left-5", "top-5");
    fireEvent.pointerUp(cardElement, { pointerId: 2, clientX: 130, clientY: 20 });
    fireEvent.keyDown(cardElement, { key: "ArrowLeft" });

    expect(screen.getByRole("status")).toHaveTextContent("Understood");
    act(() => vi.advanceTimersByTime(300));
    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });

  it("uses the learned label for a right swipe that will complete the card", () => {
    const { card: cardElement } = renderSwipeCard(makeItem(true));
    fireEvent.click(cardElement);

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

  it("shows a flip prompt before reveal and the swipe prompt after reveal", () => {
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <QuizPracticeSwipeCard item={makeItem()} onSwipe={vi.fn()} />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-quiz-practice-prompt-text]"))
      .toHaveTextContent("Guess the meaning of the word and tap the card");
    expect(document.querySelector("[data-quiz-practice-prompt]")).toHaveAttribute("data-revealed", "false");
    fireEvent.click(document.querySelector("[data-quiz-practice-swipe-card]")!);
    expect(document.querySelector('[data-quiz-practice-prompt="progress"]'))
      .toHaveTextContent("Swipe right if you know this card");
    expect(document.querySelector("[data-quiz-practice-prompt-text]")).toHaveClass("font-super-water");
    expect(document.querySelector('[data-quiz-practice-prompt-badge]'))
      .toHaveAttribute("src", expect.stringContaining("kart_ogreniliyor_madalyasi.webp"));

    rerender(
      <LocaleProvider initialLocale="en">
        <QuizPracticeSwipeCard key="learned-card" item={makeItem(true)} onSwipe={vi.fn()} />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-quiz-practice-prompt-text]"))
      .toHaveTextContent("Guess the meaning of the word and tap the card");
    fireEvent.click(document.querySelector("[data-quiz-practice-swipe-card]")!);
    expect(document.querySelector('[data-quiz-practice-prompt="learned"]'))
      .toHaveTextContent("Swipe right if you have learned this card");
    expect(document.querySelector('[data-quiz-practice-prompt-badge]'))
      .toHaveAttribute("src", expect.stringContaining("kart_ogrenildi_madalyasi.webp"));
  });

  it("keeps the grammar and Ask actions attached to the card without treating button taps as swipes", () => {
    const onSwipe = vi.fn();
    const { card: cardElement } = renderSwipeCard(makeItem(), onSwipe);
    fireEvent.click(cardElement);
    const actions = document.querySelector<HTMLElement>("[data-quiz-practice-card-actions]")!;
    const grammarButton = screen.getByRole("button", { name: "Grammar details" });
    const askButton = screen.getByRole("button", { name: "Ask" });

    expect(grammarButton).toHaveAttribute("data-show-icon", "false");
    expect(grammarButton).toHaveClass("text-base");
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

    fireEvent.click(cardElement);
    fireEvent.keyDown(cardElement, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(300));

    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it("shows a native translation or a tier-colored foreign term with pronunciation audio", () => {
    const foreignPromptCard = VOCABULARY_CARDS.find(
      (entry) => getEasyPracticePromptSide(entry.sourceKey) === "learning",
    )!;
    const { card: cardElement } = renderSwipeCard(makeItem(false, foreignPromptCard));
    const prompt = document.querySelector<HTMLElement>("[data-quiz-practice-card-prompt]")!;
    const promptText = document.querySelector<HTMLElement>("[data-quiz-practice-card-prompt-text]")!;

    expect(prompt).toHaveAttribute("data-quiz-practice-card-prompt-side", "learning");
    expect(promptText).toHaveTextContent(foreignPromptCard.term);
    expect(promptText).toHaveAttribute("lang", foreignPromptCard.language);
    expect(promptText).toHaveClass("text-[2.5rem]");
    const pronunciation = document.querySelector("[data-quiz-practice-card-pronunciation]");
    expect(pronunciation).toHaveTextContent(foreignPromptCard.pronunciation || foreignPromptCard.term);
    expect(pronunciation).toHaveClass("text-[1.75rem]");

    const speakerButton = screen.getByRole("button", {
      name: new RegExp(foreignPromptCard.term),
    });
    fireEvent.click(speakerButton);
    expect(speakCardTerm).toHaveBeenCalledWith(foreignPromptCard.term, foreignPromptCard.language);
    expect(cardElement).toHaveAttribute("data-quiz-practice-card-revealed", "false");
  });

  it("shows the native-language translation without pronunciation when that side is selected", () => {
    const nativePromptCard = VOCABULARY_CARDS.find(
      (entry) => getEasyPracticePromptSide(entry.sourceKey) === "native",
    )!;
    renderSwipeCard(makeItem(false, nativePromptCard));

    const prompt = document.querySelector<HTMLElement>("[data-quiz-practice-card-prompt]")!;
    expect(prompt).toHaveAttribute("data-quiz-practice-card-prompt-side", "native");
    expect(document.querySelector("[data-quiz-practice-card-prompt-text]")).toHaveTextContent(
      getPrimaryCardTranslation(nativePromptCard, "en"),
    );
    expect(document.querySelector("[data-quiz-practice-card-prompt-text]")).toHaveClass("text-[2.5rem]");
    expect(document.querySelector("[data-quiz-practice-card-pronunciation]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pronunciation/ })).not.toBeInTheDocument();
  });
});
