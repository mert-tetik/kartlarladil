import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLandingCardCenter } from "@/app/components/mobile-landing-card-center";
import { VOCABULARY_CARDS } from "@/data/cards";
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
});
