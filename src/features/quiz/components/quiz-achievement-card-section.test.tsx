import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
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

describe("AchievementCardSection shared vocabulary cards", () => {
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
