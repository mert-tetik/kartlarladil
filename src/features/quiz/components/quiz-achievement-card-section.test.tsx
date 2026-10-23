import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { AchievementCardSection } from "@/features/quiz/components/quiz-achievement-card-section";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
}));

const card = VOCABULARY_CARDS.find((entry) => entry.language === "ja" && entry.tier === "B1")!;

describe("AchievementCardSection shared vocabulary cards", () => {
  it("keeps the complete shared card design and progress visible, and still flips on card click", () => {
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
    expect(container.querySelector("[data-card-progress]")).toHaveAttribute("aria-valuenow", "6");

    fireEvent.click(screen.getByTestId("reference-card"));

    expect(cardShell).toHaveAttribute("data-card-face", "back");
    expect(screen.getByTestId("card-back-tier-text")).toHaveTextContent("B1");
  });

});
