import { fireEvent, render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { QuizResultMessageView } from "@/features/quiz/components/quiz-result-message-view";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));
vi.mock("@/features/quiz/components/quiz-achievement-card-section", () => ({
  AchievementCardSection: () => null,
}));

function renderResultView(onResultActionPress?: () => void) {
  return render(
    <LocaleProvider initialLocale="en">
      <QuizResultMessageView onComplete={vi.fn()} onResultActionPress={onResultActionPress} />
    </LocaleProvider>,
  );
}

describe("QuizResultMessageView continue action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plays the shared result-action sound callback and a firm phone vibration once", async () => {
    const onResultActionPress = vi.fn();
    const { container } = renderResultView(onResultActionPress);

    const continueButton = container.querySelector<HTMLButtonElement>("[data-quiz-result-message-continue]")!;
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
