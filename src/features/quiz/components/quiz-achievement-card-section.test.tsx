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
  it("uses the shared design, suppresses compact study details, and still flips on card click", () => {
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
    expect(screen.queryByTestId("card-pronunciation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-reference-example")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reference-card"));

    expect(cardShell).toHaveAttribute("data-card-face", "back");
    expect(screen.getByTestId("card-back-tier-text")).toHaveTextContent("B1");
  });

});
