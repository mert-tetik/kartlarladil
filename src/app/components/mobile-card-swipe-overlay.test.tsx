import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCardSwipeOverlay } from "@/app/components/mobile-card-swipe-overlay";
import { dispatchTutorialCardLayerPromptChanged } from "@/features/tutorial/tutorial-card-session";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
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
    useTutorialStore.setState({ active: false, completed: false, introSeen: true, step: 0, testMode: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
    useTutorialStore.setState({ active: false, completed: false, introSeen: false, step: 0, testMode: false });
  });

  it("marks the full-screen overlay to hide the mobile bottom navigation", () => {
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);

    expect(document.querySelector("[data-mobile-hide-bottom-nav='true']")).toHaveAttribute(
      "data-card-swipe-incoming-state",
    );
  });

  it("waits for the first tutorial prompt to disappear before starting the swipe demo", async () => {
    window.localStorage.removeItem("foxiesdeck:card-swipe-demo:shown");
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 0, testMode: false });
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const card = document.querySelector("[data-card-swipe-card]") as HTMLElement;
    expect(card).toBeInTheDocument();
    dispatchTutorialCardLayerPromptChanged({ layer: "draw-cards", active: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(card.style.transform).toBe("");

    dispatchTutorialCardLayerPromptChanged({ layer: "draw-cards", active: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(card.style.transform).toContain("translate3d(-124px");
  });

  it("marks the draw-card entrance complete after its animation fallback", async () => {
    render(<MobileCardSwipeOverlay open language="en" onClose={vi.fn()} />);
    const overlay = document.querySelector("[data-mobile-hide-bottom-nav='true']");
    expect(overlay).toHaveAttribute("data-card-swipe-entry-complete", "false");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      const mountFrames = [...animationFrames.values()];
      animationFrames.clear();
      mountFrames.forEach((callback) => callback(performance.now()));
    });
    await act(async () => {
      const enterFrames = [...animationFrames.values()];
      animationFrames.clear();
      enterFrames.forEach((callback) => callback(performance.now()));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400);
    });

    expect(overlay).toHaveAttribute("data-card-swipe-entry-complete", "true");
  });

  it("shows the next card immediately while the outgoing card exits", async () => {
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
    expect(document.querySelector('[data-card-swipe-outgoing-state="add"]')).toHaveStyle({ borderRadius: "12% / 8.5%" });
    expect(document.querySelector('[data-card-swipe-state="idle"]')).toHaveStyle({ borderRadius: "12% / 8.5%" });
    expect(document.querySelector("[data-card-swipe-card]")).toBeInTheDocument();
    expect(document.querySelector("[data-vocabulary-card='A2']")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 180px, 0) rotate(0deg)", opacity: "0" });
    expect(document.querySelector("[data-card-swipe-card]")).not.toBe(swipeCard);
    expect(document.querySelector("[data-card-swipe-card]")).not.toHaveStyle({ transition: "none" });

    await act(async () => {
      const frames = [...animationFrames.values()];
      animationFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-outgoing]")).toHaveClass("duration-[320ms]");
    expect(document.querySelector("[data-mobile-hide-bottom-nav='true']")).toHaveAttribute("data-card-swipe-incoming-state", "entering");
    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) rotate(0deg)", opacity: "1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(addCardMock).toHaveBeenCalledWith("A1");
    expect(document.querySelector("[data-card-swipe-outgoing]")).not.toBeInTheDocument();
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

  it("keeps the visible card mounted for the complete reverse exit animation", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<MobileCardSwipeOverlay open language="en" onClose={onClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    rerender(<MobileCardSwipeOverlay open={false} language="en" onClose={onClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(899);
    });

    expect(document.querySelector("[data-card-swipe-phase='exiting']")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });

    expect(document.querySelector("[data-card-swipe-phase='exiting']")).not.toBeInTheDocument();
  });
});
