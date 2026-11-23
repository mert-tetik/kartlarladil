import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LocaleProvider } from "@/i18n/locale-provider";
import { QuizDeckCardAdditionView } from "@/features/quiz/components/quiz-deck-card-addition-view";
import { QUIZ_END_ACTION_TAP_GUARD_GRACE_MS } from "@/features/quiz/quiz-end-triple-tap";

const inventoryMock = vi.hoisted(() => ({
  state: { cards: [] as unknown[], activeCardLimit: null as number | null, addCard: vi.fn() },
}));
const cardRepositoryMock = vi.hoisted(() => ({
  cards: [] as Array<{ id: string; sourceKey: string; language: string }>,
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: Object.assign(
    (selector: (state: typeof inventoryMock.state) => unknown) => selector(inventoryMock.state),
    { getState: () => inventoryMock.state },
  ),
}));

vi.mock("@/features/cards/card-repository", () => ({
  localCardRepository: {
    list: ({ language }: { language: string }) => cardRepositoryMock.cards.filter((card) => card.language === language),
    findById: (id: string) => cardRepositoryMock.cards.find((card) => card.id === id || card.sourceKey === id),
  },
}));

vi.mock("@/components/app-message-provider", () => ({
  useAppMessage: () => ({ showMessage: vi.fn() }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
}));

vi.mock("@/features/subscriptions/components/upgrade-dialog", () => ({
  UpgradeDialog: ({ open }: { open: boolean }) => open ? <div data-testid="subscription-restriction" /> : null,
}));

beforeEach(() => {
  inventoryMock.state.cards = [];
  inventoryMock.state.activeCardLimit = null;
  inventoryMock.state.addCard.mockReset();
  cardRepositoryMock.cards = [];
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

afterEach(() => {
  if (originalAnimateDescriptor) {
    Object.defineProperty(Element.prototype, "animate", originalAnimateDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, "animate");
  }
});

describe("QuizDeckCardAdditionView transitions", () => {
  it("scale-staggers its UI top-to-bottom and exits in reverse without a screen slide or backdrop", async () => {
    const animationFinishers: Array<() => void> = [];
    const animationInputs: Array<{
      element: HTMLElement;
      keyframes: Keyframe[] | PropertyIndexedKeyframes;
      options?: KeyframeAnimationOptions;
    }> = [];
    const animateMock = vi.fn(function (
      this: HTMLElement,
      keyframes: Keyframe[] | PropertyIndexedKeyframes,
      options?: KeyframeAnimationOptions,
    ) {
      animationInputs.push({ element: this, keyframes, options });
      let resolveFinished!: (animation: Animation) => void;
      const finished = new Promise<Animation>((resolve) => {
        resolveFinished = resolve;
      });
      animationFinishers.push(() => resolveFinished({} as Animation));
      return { finished, cancel: vi.fn() } as unknown as Animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animateMock,
    });

    const onContinue = vi.fn();
    const onActionPress = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <QuizDeckCardAdditionView
          language="en"
          onContinue={onContinue}
          onActionPress={onActionPress}
        />
      </LocaleProvider>,
    );

    const root = document.querySelector("[data-quiz-deck-card-addition]");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(root).not.toHaveClass("quiz-flow-enter-right", "quiz-flow-exit-left");
    expect(root?.className).not.toContain("bg-");
    expect(animateMock).toHaveBeenCalledTimes(4);
    expect(animationInputs.map(({ element }) => element.dataset.quizDeckCardAdditionItem)).toEqual([
      "title",
      "count",
      "empty",
      "continue",
    ]);
    expect(animationInputs.map(({ options }) => options?.delay)).toEqual([0, 55, 110, 165]);
    expect(animationInputs[0]?.keyframes).toEqual([
      { transform: "scale(0)" },
      { transform: "scale(1)" },
    ]);
    expect(continueButton).toBeDisabled();

    await act(async () => {
      animationFinishers.slice(0, 4).forEach((finish) => finish());
      await Promise.resolve();
    });

    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(onActionPress).toHaveBeenCalledOnce();
    expect(root).toHaveAttribute("data-transition-state", "exiting");
    expect(animationInputs.slice(4).map(({ element }) => element.dataset.quizDeckCardAdditionItem)).toEqual([
      "continue",
      "empty",
      "count",
      "title",
    ]);
    expect(animationInputs.slice(4).map(({ options }) => options?.delay)).toEqual([0, 55, 110, 165]);
    expect(animationInputs[4]?.keyframes).toEqual([
      { transform: "scale(1)" },
      { transform: "scale(0)" },
    ]);
    expect(onContinue).not.toHaveBeenCalled();

    await act(async () => {
      animationFinishers.slice(4, 7).forEach((finish) => finish());
      await Promise.resolve();
    });
    expect(onContinue).not.toHaveBeenCalled();

    await act(async () => {
      animationFinishers[7]?.();
      await Promise.resolve();
    });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("commits a single card tap after gesture recognition and keeps the count stable when cloud persistence settles", async () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "en" && candidate.tier === "A1" && candidate.termKind === "word",
    );
    expect(card).toBeDefined();
    cardRepositoryMock.cards = [card!];

    let finishPersistence!: (result: { ok: boolean; firstCardAdded: boolean }) => void;
    inventoryMock.state.addCard.mockImplementation((cardId: string) => {
      inventoryMock.state.cards = [
        ...inventoryMock.state.cards,
        { cardId, status: "active", correctCount: 0, addedAt: "optimistic" },
      ];
      return new Promise((resolve) => {
        finishPersistence = resolve;
      });
    });

    const { container, rerender } = render(
      <LocaleProvider initialLocale="en">
        <QuizDeckCardAdditionView language="en" onContinue={vi.fn()} onActionPress={vi.fn()} />
      </LocaleProvider>,
    );

    const count = container.querySelector("[data-quiz-deck-card-addition-count]");
    const cardButton = screen.getByRole("button", { name: `${card!.term}: Add to cards` });
    expect(count).toHaveTextContent("0");

    vi.useFakeTimers();
    fireEvent.click(cardButton);

    expect(inventoryMock.state.addCard).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(inventoryMock.state.addCard).toHaveBeenCalledWith(card!.id);
    expect(count).toHaveTextContent("1");
    expect(cardButton).toBeDisabled();

    await act(async () => {
      inventoryMock.state.cards = inventoryMock.state.cards.map((inventoryCard) => ({
        ...(inventoryCard as Record<string, unknown>),
        addedAt: "persisted",
      }));
      finishPersistence({ ok: true, firstCardAdded: false });
      await Promise.resolve();
      rerender(
        <LocaleProvider initialLocale="en">
          <QuizDeckCardAdditionView language="en" onContinue={vi.fn()} onActionPress={vi.fn()} />
        </LocaleProvider>,
      );
    });

    expect(count).toHaveTextContent("1");
  });

  it("opens the Free restriction without calling addCard or changing the entry count at the limit", async () => {
    const [ownedCard, candidateCard] = VOCABULARY_CARDS.filter(
      (candidate) => candidate.language === "en" && candidate.tier === "A1" && candidate.termKind === "word",
    );
    expect(ownedCard).toBeDefined();
    expect(candidateCard).toBeDefined();
    cardRepositoryMock.cards = [ownedCard!, candidateCard!];
    inventoryMock.state.cards = [{
      cardId: ownedCard!.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "existing",
    }];
    inventoryMock.state.activeCardLimit = 1;

    const { container } = render(
      <LocaleProvider initialLocale="en">
        <QuizDeckCardAdditionView language="en" onContinue={vi.fn()} onActionPress={vi.fn()} />
      </LocaleProvider>,
    );

    const count = container.querySelector("[data-quiz-deck-card-addition-count]");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: `${candidateCard!.term}: Add to cards` }));

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(inventoryMock.state.addCard).not.toHaveBeenCalled();
    expect(count).toHaveTextContent("1");
    expect(screen.getByTestId("subscription-restriction")).toBeInTheDocument();
  });

  it("adds a card immediately when the screen's initial tap-guard period has ended", async () => {
    vi.useFakeTimers();
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "en" && candidate.tier === "A1" && candidate.termKind === "word",
    );
    expect(card).toBeDefined();
    cardRepositoryMock.cards = [card!];
    inventoryMock.state.addCard.mockImplementation((cardId: string) => {
      inventoryMock.state.cards = [
        ...inventoryMock.state.cards,
        { cardId, status: "active", correctCount: 0, addedAt: "optimistic" },
      ];
      return Promise.resolve({ ok: true, firstCardAdded: false });
    });

    render(
      <LocaleProvider initialLocale="en">
        <QuizDeckCardAdditionView language="en" onContinue={vi.fn()} onActionPress={vi.fn()} />
      </LocaleProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(QUIZ_END_ACTION_TAP_GUARD_GRACE_MS + 1);
    });
    fireEvent.click(screen.getByRole("button", { name: `${card!.term}: Add to cards` }));

    expect(inventoryMock.state.addCard).toHaveBeenCalledOnce();
    expect(inventoryMock.state.addCard).toHaveBeenCalledWith(card!.id);
  });

  it("does not attempt to add a card on double or triple taps", async () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "en" && candidate.tier === "A1" && candidate.termKind === "word",
    );
    expect(card).toBeDefined();
    cardRepositoryMock.cards = [card!];

    render(
      <LocaleProvider initialLocale="en">
        <QuizDeckCardAdditionView language="en" onContinue={vi.fn()} onActionPress={vi.fn()} />
      </LocaleProvider>,
    );

    const cardButton = screen.getByRole("button", { name: `${card!.term}: Add to cards` });
    vi.useFakeTimers();
    fireEvent.click(cardButton);
    fireEvent.click(cardButton);

    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(inventoryMock.state.addCard).not.toHaveBeenCalled();

    fireEvent.click(cardButton);
    fireEvent.click(cardButton);
    fireEvent.click(cardButton);
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(inventoryMock.state.addCard).not.toHaveBeenCalled();
  });
});
