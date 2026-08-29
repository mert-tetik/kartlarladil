import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCardSwipeOverlay } from "@/app/components/mobile-card-swipe-overlay";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

const { cancelCardPronunciationMock, enqueueCardPronunciationMock } = vi.hoisted(() => ({
  cancelCardPronunciationMock: vi.fn(),
  enqueueCardPronunciationMock: vi.fn(),
}));

const addCardMock = vi.fn();
const inventoryState: {
  cards: InventoryCard[];
  activeCardLimit: number | null;
  addCard: typeof addCardMock;
} = {
  cards: [],
  activeCardLimit: null,
  addCard: addCardMock,
};

vi.mock("@/features/cards/card-repository", () => ({
  localCardRepository: {
    list: ({ tier }: { tier: string }) => [createCard(tier)],
  },
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: typeof inventoryState) => unknown) => selector(inventoryState),
}));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ card }: { card: VocabularyCard }) => <div data-vocabulary-card={card.id} />,
}));

vi.mock("@/features/cards/card-pronunciation-client", () => ({
  cancelCardPronunciation: cancelCardPronunciationMock,
  enqueueCardPronunciation: enqueueCardPronunciationMock,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
  useLocale: () => ({ locale: "tr" }),
}));

function createCard(tier: string) {
  return {
    id: tier,
    sourceKey: tier,
    language: "en",
    tier,
    term: tier,
    translation: tier,
    example: tier,
  } as unknown as VocabularyCard;
}

describe("MobileCardSwipeOverlay", () => {
  let animationFrames = new Map<number, FrameRequestCallback>();
  let nextAnimationFrameId = 1;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.setItem("foxiesdeck:card-swipe-demo:shown", "1");
    animationFrames = new Map();
    nextAnimationFrameId = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      animationFrames.delete(frameId);
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    addCardMock.mockReset();
    addCardMock.mockResolvedValue({ ok: true, firstCardAdded: false });
    cancelCardPronunciationMock.mockReset();
    enqueueCardPronunciationMock.mockReset();
    inventoryState.cards = [];
    inventoryState.activeCardLimit = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("marks the full-screen overlay to hide the mobile bottom navigation", () => {
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);

    expect(document.querySelector("[data-mobile-hide-bottom-nav='true']")).toHaveAttribute(
      "data-card-swipe-incoming-state",
    );
  });

  it("waits for the outgoing card to leave before bringing the next card in from below", async () => {
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const swipeCard = document.querySelector("[data-card-swipe-card]") as HTMLElement;
    expect(swipeCard).toBeInTheDocument();
    fireEvent.pointerDown(swipeCard, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(swipeCard, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerUp(swipeCard, { pointerId: 1, clientX: 250, clientY: 100 });

    expect(document.querySelector("[data-card-swipe-outgoing]")).toBeInTheDocument();
    expect(addCardMock).not.toHaveBeenCalled();
    expect(document.querySelector("[data-card-swipe-outgoing]")).toHaveStyle({ transform: "translate3d(150px, 0, 0) rotate(8.333333333333334deg)" });
    expect(document.querySelector('[data-card-swipe-outgoing-state="add"]')).toHaveClass("bg-emerald-500/85");
    expect(document.querySelector("[data-card-swipe-card]")).not.toBeInTheDocument();

    await act(async () => {
      const frames = [...animationFrames.values()];
      animationFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(288);
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).not.toBeInTheDocument();

    await act(async () => {
      const frames = [...animationFrames.values()];
      animationFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
    });

    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 180px, 0) rotate(0deg)", opacity: "0" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) rotate(0deg)", opacity: "1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(521);
    });

    expect(addCardMock).toHaveBeenCalledWith("A1");
  });

  it("cancels pronunciation work when the visible card is skipped", async () => {
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const swipeCard = document.querySelector("[data-card-swipe-card]") as HTMLElement;
    fireEvent.pointerDown(swipeCard, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerMove(swipeCard, { pointerId: 1, clientX: 50, clientY: 100 });
    fireEvent.pointerUp(swipeCard, { pointerId: 1, clientX: 50, clientY: 100 });

    expect(cancelCardPronunciationMock).toHaveBeenCalledWith("A1");
  });

  it("opens the active card limit popup instead of swiping a card into a full deck", async () => {
    inventoryState.cards = [{ cardId: "active-card", status: "active", correctCount: 0, addedAt: "2026-07-17T00:00:00.000Z" }];
    inventoryState.activeCardLimit = 1;
    const onSubscriptionLimitReached = vi.fn();

    render(
      <MobileCardSwipeOverlay
        open
        language="en"
        onClose={vi.fn()}
        onSubscriptionLimitReached={onSubscriptionLimitReached}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const swipeCard = document.querySelector("[data-card-swipe-card]") as HTMLElement;
    fireEvent.pointerDown(swipeCard, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(swipeCard, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerUp(swipeCard, { pointerId: 1, clientX: 250, clientY: 100 });

    expect(onSubscriptionLimitReached).toHaveBeenCalledWith("free_active_card_limit");
    expect(document.querySelector("[data-card-swipe-outgoing]")).not.toBeInTheDocument();
    expect(addCardMock).not.toHaveBeenCalled();
  });
});
