import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { QuizResultMessageView } from "@/features/quiz/components/quiz-result-message-view";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { VocabularyCard } from "@/types/domain";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));
vi.mock("@/features/quiz/components/quiz-achievement-card-section", () => ({
  AchievementCardSection: ({ title, tone }: { title: string; tone: string }) => (
    <h2 data-testid={`achievement-${tone}`}>{title}</h2>
  ),
}));

function renderResultView(
  onResultActionPress?: () => void,
  learnedCards: readonly VocabularyCard[] = [],
  advancedCards: readonly VocabularyCard[] = [],
) {
  return render(
    <LocaleProvider initialLocale="en">
      <QuizResultMessageView
        onComplete={vi.fn()}
        onResultActionPress={onResultActionPress}
        learnedCards={learnedCards}
        advancedCards={advancedCards}
      />
    </LocaleProvider>,
  );
}

describe("QuizResultMessageView continue action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows learned and level-up counts even when both are zero", () => {
    renderResultView();

    expect(screen.getByTestId("achievement-learned")).toHaveTextContent("You learned 0 cards");
    expect(screen.getByTestId("achievement-advanced")).toHaveTextContent("0 cards levelled up");
  });

  it("uses the actual learned and level-up card counts", () => {
    const card = VOCABULARY_CARDS[0];
    renderResultView(undefined, [card, card], [card, card, card]);

    expect(screen.getByTestId("achievement-learned")).toHaveTextContent("You learned 2 cards");
    expect(screen.getByTestId("achievement-advanced")).toHaveTextContent("3 cards levelled up");
  });

  it("plays the shared result-action sound callback and a firm phone vibration once", async () => {
    const onResultActionPress = vi.fn();
    const { container } = renderResultView(onResultActionPress);

    const continueButton = container.querySelector<HTMLButtonElement>("[data-quiz-result-message-continue]")!;
    expect(container.querySelector("[data-quiz-result-message-view]"))
      .toHaveAttribute("data-quiz-end-triple-tap-screen");
    expect(continueButton).toHaveAttribute("data-quiz-end-continue");
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);

    expect(onResultActionPress).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledExactlyOnceWith("firm-tap");
    expect(playSoundEffect).not.toHaveBeenCalled();
  });

  it("plays the fallback result-action sound and firm vibration when no callback is supplied", async () => {
    const { container } = renderResultView();

    const continueButton = container.querySelector<HTMLButtonElement>("[data-quiz-result-message-continue]")!;
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);

    expect(playSoundEffect).toHaveBeenCalledExactlyOnceWith("result-action-press");
    expect(vibrate).toHaveBeenCalledExactlyOnceWith("firm-tap");
  });
});
