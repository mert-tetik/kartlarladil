import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { NativeLoadingCardCarousel } from "@/app/components/native-loading-card-carousel";

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ card }: { card: { sourceKey: string } }) => (
    <div data-testid="mock-vocabulary-card">{card.sourceKey}</div>
  ),
}));

const cards = VOCABULARY_CARDS
  .filter((card) => card.language === "en" && card.termKind === "word")
  .slice(0, 8);

afterEach(() => {
  vi.useRealTimers();
});

describe("native loading card carousel", () => {
  it("fully exits each four-card group before the next group enters from the right", () => {
    vi.useFakeTimers();
    const view = render(<NativeLoadingCardCarousel cards={cards} />);
    const root = view.container.querySelector<HTMLElement>("[data-native-loading-cards]");
    if (!root) throw new Error("Expected the native loading card stage");

    const readVisibleSourceKeys = () => Array.from(
      root.querySelectorAll<HTMLElement>('[data-card-motion="still"]'),
      (card) => card.dataset.cardSource,
    );

    expect(root.dataset.activeGroup).toBe("0");
    expect(root.dataset.transitionPhase).toBe("hold");
    expect(readVisibleSourceKeys()).toEqual(cards.slice(0, 4).map((card) => card.sourceKey));

    act(() => vi.advanceTimersByTime(420));
    expect(root.dataset.transitionPhase).toBe("exit");
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-card-motion="exit"]'))
      .map((card) => card.dataset.cardSource)).toEqual(cards.slice(0, 4).map((card) => card.sourceKey));
    expect(root.querySelectorAll('[data-card-motion="enter"]')).toHaveLength(0);
    expect(Array.from(root.querySelectorAll<HTMLElement>("[data-native-loading-card-slot]"))
      .map((slot) => slot.querySelector<HTMLElement>('[data-card-motion="exit"]')?.style.animationDelay))
      .toEqual(["0ms", "130ms", "260ms", "390ms"]);

    act(() => vi.advanceTimersByTime(789));
    expect(root.dataset.transitionPhase).toBe("exit");
    expect(root.querySelectorAll('[data-card-motion="enter"]')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(1));
    expect(root.dataset.transitionPhase).toBe("enter");
    expect(root.dataset.activeGroup).toBe("0");
    expect(root.querySelectorAll('[data-card-motion="exit"]')).toHaveLength(0);
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-card-motion="enter"]'))
      .map((card) => card.dataset.cardSource)).toEqual(cards.slice(4, 8).map((card) => card.sourceKey));
    expect(Array.from(root.querySelectorAll<HTMLElement>("[data-native-loading-card-slot]"))
      .map((slot) => slot.querySelector<HTMLElement>('[data-card-motion="enter"]')?.style.animationDelay))
      .toEqual(["0ms", "130ms", "260ms", "390ms"]);

    act(() => vi.advanceTimersByTime(789));
    expect(root.dataset.transitionPhase).toBe("enter");
    expect(root.dataset.activeGroup).toBe("0");

    act(() => vi.advanceTimersByTime(1));
    expect(root.dataset.activeGroup).toBe("1");
    expect(root.dataset.transitionPhase).toBe("hold");
    expect(readVisibleSourceKeys()).toEqual(cards.slice(4, 8).map((card) => card.sourceKey));

    act(() => vi.advanceTimersByTime(420));
    expect(root.dataset.transitionPhase).toBe("exit");
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-card-motion="exit"]'))
      .map((card) => card.dataset.cardSource)).toEqual(cards.slice(4, 8).map((card) => card.sourceKey));
    expect(root.querySelectorAll('[data-card-motion="enter"]')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(790));
    expect(root.dataset.transitionPhase).toBe("enter");
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-card-motion="enter"]'))
      .map((card) => card.dataset.cardSource)).toEqual(cards.slice(0, 4).map((card) => card.sourceKey));
    expect(root.querySelectorAll('[data-card-motion="exit"]')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(790));
    expect(root.dataset.activeGroup).toBe("0");
    expect(root.dataset.transitionPhase).toBe("hold");
    expect(readVisibleSourceKeys()).toEqual(cards.slice(0, 4).map((card) => card.sourceKey));

    view.unmount();
  });
});
