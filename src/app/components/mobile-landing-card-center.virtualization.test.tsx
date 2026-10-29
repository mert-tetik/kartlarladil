import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLandingCardCenter } from "@/app/components/mobile-landing-card-center";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/app/components/mobile-card-podium-overlay", () => ({
  MobileCardPodiumOverlay: () => null,
}));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ card }: { card: { term: string } }) => (
    <div data-testid="virtualized-vocabulary-card">{card.term}</div>
  ),
}));

const sourceCards = VOCABULARY_CARDS.filter((card) => card.language === "en");

function createCards(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const card = sourceCards[index % sourceCards.length];
    return {
      card,
      inventory: {
        cardId: card.id,
        status: "active" as const,
        correctCount: 0,
        addedAt: new Date(2026, 0, 1, 0, index).toISOString(),
      },
    };
  });
}

describe("MobileLandingCardCenter card windowing", () => {
  it("mounts only a bounded viewport window for a 1000-card collection", async () => {
    render(
      <LocaleProvider initialLocale="en">
        <MobileLandingCardCenter
          activeCards={createCards(1000)}
          learnedCards={[]}
          selectedLanguage="en"
          status="active"
          isOpen
          onStatusChange={vi.fn()}
          onOpenChange={vi.fn()}
          onOpenDraw={vi.fn()}
          onOpenImageTranslate={vi.fn()}
          onOpenCreate={vi.fn()}
          onOpenGroups={vi.fn()}
          showEmptyDeckPointer={false}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("virtualized-vocabulary-card").length).toBeLessThan(1000);
    });

    expect(screen.getAllByTestId("virtualized-vocabulary-card").length).toBeLessThanOrEqual(36);
    const grid = document.querySelector<HTMLElement>("[data-mobile-card-grid]");
    expect(grid).not.toBeNull();
    expect(Number.parseFloat(grid?.style.height ?? "0")).toBeGreaterThan(1000);
  });
});
