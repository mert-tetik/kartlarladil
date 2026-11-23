import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { GlobalTapVibration } from "@/components/global-tap-vibration";
import { AchievementCardSection } from "@/features/quiz/components/quiz-achievement-card-section";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
}));

const card = VOCABULARY_CARDS.find((entry) => entry.language === "ja" && entry.tier === "B1")!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AchievementCardSection shared vocabulary cards", () => {
  it("localizes the accessible label for selectable cards", () => {
    render(
      <LocaleProvider initialLocale="en">
        <AchievementCardSection
          title="Add cards to your deck"
          cards={[card]}
          tone="learned"
          reveal={false}
          exiting={false}
          staggerOffsetMs={0}
          selectedCardIds={new Set()}
          onCardSelect={() => undefined}
        />
      </LocaleProvider>,
    );

    const addCardButton = screen.getByRole("button", { name: `${card.term}: Add to cards` });
    expect(addCardButton).toBeInTheDocument();
    expect(addCardButton).toHaveAttribute("data-tap-vibration", "firm");
  });

  it("ignores a scroll gesture as a card tap but keeps stationary taps and firm haptics", () => {
    vi.mocked(vibrate).mockClear();
    const onCardSelect = vi.fn();
    render(
      <>
        <GlobalTapVibration />
        <LocaleProvider initialLocale="en">
          <AchievementCardSection
            title="Add cards to your deck"
            cards={[card]}
            tone="learned"
            reveal={false}
            exiting={false}
            staggerOffsetMs={0}
            selectedCardIds={new Set()}
            onCardSelect={onCardSelect}
          />
        </LocaleProvider>
      </>,
    );

    const addCardButton = screen.getByRole("button", { name: `${card.term}: Add to cards` });
    fireEvent.pointerDown(addCardButton, { pointerId: 7, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: "touch", clientX: 42, clientY: 62 });
    fireEvent.pointerUp(window, { pointerId: 7, pointerType: "touch", clientX: 42, clientY: 62 });
    fireEvent.click(addCardButton);

    expect(onCardSelect).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();

    fireEvent.pointerDown(addCardButton, { pointerId: 8, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.pointerUp(addCardButton, { pointerId: 8, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.click(addCardButton);

    expect(onCardSelect).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith("firm-tap");
  });

  it("does not select a card when native scrolling cancels the touch gesture", () => {
    const onCardSelect = vi.fn();
    render(
      <>
        <GlobalTapVibration />
        <LocaleProvider initialLocale="en">
          <div data-quiz-deck-card-addition-scroll>
            <AchievementCardSection
              title="Add cards to your deck"
              cards={[card]}
              tone="learned"
              reveal={false}
              exiting={false}
              staggerOffsetMs={0}
              selectedCardIds={new Set()}
              onCardSelect={onCardSelect}
            />
          </div>
        </LocaleProvider>
      </>,
    );

    const addCardButton = screen.getByRole("button", { name: `${card.term}: Add to cards` });
    fireEvent.pointerDown(addCardButton, { pointerId: 9, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.pointerCancel(window, { pointerId: 9, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.click(addCardButton);

    expect(onCardSelect).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does not select a card when the card list scrolls under a stationary finger", () => {
    const onCardSelect = vi.fn();
    const { container } = render(
      <>
        <GlobalTapVibration />
        <LocaleProvider initialLocale="en">
          <div data-quiz-deck-card-addition-scroll>
            <AchievementCardSection
              title="Add cards to your deck"
              cards={[card]}
              tone="learned"
              reveal={false}
              exiting={false}
              staggerOffsetMs={0}
              selectedCardIds={new Set()}
              onCardSelect={onCardSelect}
            />
          </div>
        </LocaleProvider>
      </>,
    );

    const scrollContainer = container.querySelector<HTMLElement>("[data-quiz-deck-card-addition-scroll]")!;
    const addCardButton = screen.getByRole("button", { name: `${card.term}: Add to cards` });
    fireEvent.pointerDown(addCardButton, { pointerId: 10, pointerType: "touch", clientX: 40, clientY: 40 });
    scrollContainer.scrollTop = 24;
    fireEvent.scroll(scrollContainer);
    fireEvent.pointerUp(window, { pointerId: 10, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.click(addCardButton);

    expect(onCardSelect).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("pairs a light vibration with each sequential card-reveal sound", () => {
    vi.useFakeTimers();
    try {
      render(
        <LocaleProvider initialLocale="en">
          <AchievementCardSection
            title="Learned cards"
            cards={[card, { ...card, id: `${card.id}-second` }]}
            tone="learned"
            reveal
            exiting={false}
            staggerOffsetMs={0}
          />
        </LocaleProvider>,
      );

      act(() => vi.advanceTimersByTime(149));
      expect(playSoundEffect).not.toHaveBeenCalled();
      expect(vibrate).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));
      expect(playSoundEffect).toHaveBeenCalledWith("result-card-reveal");
      expect(vibrate).toHaveBeenCalledWith("reward-arrival");
      expect(vibrate).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(55));
      expect(vibrate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the learned medal on learned result cards and still flips on click", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <AchievementCardSection
          title="Learned cards"
          cards={[card]}
          tone="learned"
          reveal={false}
          exiting={false}
          staggerOffsetMs={0}
        />
      </LocaleProvider>,
    );

    const cardShell = container.querySelector<HTMLElement>("[data-card-face]");
    expect(cardShell).toHaveAttribute("data-card-face", "front");
    expect(screen.getByTestId("reference-card")).toBeInTheDocument();
    expect(screen.getByTestId("card-tier-badge")).toHaveTextContent("B1");
    expect(screen.getByTestId("card-pronunciation")).toBeVisible();
    expect(screen.getByTestId("card-reference-example")).toBeVisible();
    expect(container.querySelector("[data-card-progress-medal]")).toBeInTheDocument();
    expect(container.querySelector("[data-card-progress]")).not.toBeInTheDocument();
    expect(cardShell).toHaveAttribute("data-card-learning-status", "learned");
    expect(screen.queryByRole("button", { name: `${card.term} Ask` })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reference-card"));

    expect(cardShell).toHaveAttribute("data-card-face", "back");
    expect(screen.getByTestId("card-back-tier-text")).toHaveTextContent("B1");
  });

});
