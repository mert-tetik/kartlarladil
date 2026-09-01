import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLandingCardCenter } from "@/app/components/mobile-landing-card-center";
import { VOCABULARY_CARDS } from "@/data/cards";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/app/components/mobile-card-display-sheet", () => ({
  MobileCardDisplaySheet: () => null,
}));

const card = VOCABULARY_CARDS.find((item) => item.language === "en")!;
const activeCards = [{
  card,
  inventory: {
    cardId: card.id,
    status: "active" as const,
    correctCount: 0,
    addedAt: "2026-07-20T00:00:00.000Z",
  },
}];
const learnedCard = VOCABULARY_CARDS.find((item) => item.language === "en" && item.id !== card.id)!;
const learnedCards = [{
  card: learnedCard,
  inventory: {
    cardId: learnedCard.id,
    status: "learned" as const,
    correctCount: 8,
    addedAt: "2026-07-21T00:00:00.000Z",
  },
}];

describe("MobileLandingCardCenter", () => {
  it("keeps filters directly below the mobile navbar while the landing dashboard scrolls", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingCardCenter
          activeCards={activeCards}
          learnedCards={[]}
          selectedLanguage="en"
          status="all"
          isOpen
          onStatusChange={vi.fn()}
          onOpenChange={vi.fn()}
          onOpenDraw={vi.fn()}
          onOpenCreate={vi.fn()}
          onOpenGroups={vi.fn()}
          showEmptyDeckPointer={false}
        />
      </LocaleProvider>,
    );

    const filters = document.querySelector<HTMLElement>("[data-mobile-card-filters]");

    if (!filters) {
      throw new Error("Mobile card filters were not rendered.");
    }

    expect(filters).toHaveClass("sticky", "top-[-0.875rem]");
    expect(filters).not.toHaveClass("fixed");
  });

  it("shows a tier progress bar under every card and completes learned cards with the reward gradient", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingCardCenter
          activeCards={activeCards}
          learnedCards={learnedCards}
          selectedLanguage="en"
          status="all"
          isOpen
          onStatusChange={vi.fn()}
          onOpenChange={vi.fn()}
          onOpenDraw={vi.fn()}
          onOpenCreate={vi.fn()}
          onOpenGroups={vi.fn()}
          showEmptyDeckPointer={false}
        />
      </LocaleProvider>,
    );

    const rows = document.querySelectorAll<HTMLElement>("[data-mobile-card-row]");
    const progressBars = document.querySelectorAll<HTMLElement>("[data-card-progress-bar]");
    const fills = Array.from(document.querySelectorAll<HTMLElement>("[data-card-progress-fill]"));
    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-card-progress-label]"));
    const learnedFill = fills.find((fill) => fill.classList.contains("bg-gradient-to-r"));
    const activeFill = fills.find((fill) => !fill.classList.contains("bg-gradient-to-r"));

    expect(rows).toHaveLength(2);
    expect(progressBars).toHaveLength(2);
    expect(labels).toHaveLength(2);
    expect(labels.map((label) => label.textContent)).toEqual([
      `${TIER_REQUIREMENTS[learnedCard.tier]}/${TIER_REQUIREMENTS[learnedCard.tier]}`,
      `0/${TIER_REQUIREMENTS[card.tier]}`,
    ]);
    expect(Array.from(progressBars).map((bar) => bar.getAttribute("aria-valuenow"))).toEqual(["100", "0"]);
    expect(learnedFill).toHaveClass("bg-gradient-to-r", "from-amber-300", "to-orange-500");
    expect(learnedFill).toHaveStyle({ width: "100%" });
    expect(activeFill).toHaveStyle({ width: "0%" });
  });
});
