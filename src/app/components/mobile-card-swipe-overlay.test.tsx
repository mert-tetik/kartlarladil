import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCardSwipeOverlay } from "@/app/components/mobile-card-swipe-overlay";
import type { VocabularyCard } from "@/types/domain";

const addCardMock = vi.fn();

vi.mock("@/features/cards/card-repository", () => ({
  localCardRepository: {
    list: ({ tier }: { tier: string }) => [createCard(tier)],
  },
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: { cards: never[]; addCard: typeof addCardMock }) => unknown) =>
    selector({ cards: [], addCard: addCardMock }),
}));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ card }: { card: VocabularyCard }) => <div data-vocabulary-card={card.id} />,
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
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
    expect(addCardMock).toHaveBeenCalledWith("A1");
    expect(document.querySelector("[data-card-swipe-outgoing]")).toHaveStyle({ transform: "translate3d(150px, 0, 0) rotate(8.333333333333334deg)" });
    expect(document.querySelector('[data-card-swipe-outgoing-state="add"]')).toHaveClass("bg-emerald-500/85");
    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 180px, 0) rotate(0deg)", opacity: "0" });

    await act(async () => {
      const frames = [...animationFrames.values()];
      animationFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 180px, 0) rotate(0deg)", opacity: "0" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(288);
    });

    expect(document.querySelector("[data-card-swipe-outgoing]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: `translate3d(${window.innerWidth + 80}px, 180px, 0) rotate(0deg)`, opacity: "0" });

    await act(async () => {
      const frames = [...animationFrames.values()];
      animationFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(document.querySelector("[data-card-swipe-card]")).toHaveStyle({ transform: "translate3d(0px, 0px, 0) rotate(0deg)", opacity: "1" });
  });
});
