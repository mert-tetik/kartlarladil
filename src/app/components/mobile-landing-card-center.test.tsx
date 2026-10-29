import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLandingCardCenter } from "@/app/components/mobile-landing-card-center";
import { VOCABULARY_CARDS } from "@/data/cards";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { LOCALE_CODES } from "@/i18n/config";
import { DICTIONARIES, translate } from "@/i18n/dictionaries";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/app/components/mobile-card-podium-overlay", () => ({
  MobileCardPodiumOverlay: () => null,
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
  it("shows a localized empty message with the selected card language", () => {
    render(
      <AuthSessionProvider user={null}>
        <LocaleProvider initialLocale="tr">
          <MobileLandingCardCenter
            activeCards={[]}
            learnedCards={[]}
            selectedLanguage="en"
            status="all"
            isOpen
            onStatusChange={vi.fn()}
            onOpenChange={vi.fn()}
            onOpenDraw={vi.fn()}
            onOpenImageTranslate={vi.fn()}
            onOpenCreate={vi.fn()}
            onOpenGroups={vi.fn()}
            showEmptyDeckPointer={false}
          />
        </LocaleProvider>
      </AuthSessionProvider>,
    );

    expect(screen.getByText("İngilizce dilinde hiç kelimeniz yok.")).toBeVisible();
  });

  it.each(LOCALE_CODES)("provides the empty message translation for %s", (locale) => {
    const key = "home.mobile.noWordsInLanguage";

    expect(DICTIONARIES[locale][key]).toContain("{language}");
    expect(translate(locale, key, { language: "English" })).not.toContain("{language}");
  });

  it("keeps filters directly below the mobile navbar while the landing dashboard scrolls", () => {
    render(
      <AuthSessionProvider user={null}>
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
            onOpenImageTranslate={vi.fn()}
            onOpenCreate={vi.fn()}
            onOpenGroups={vi.fn()}
            showEmptyDeckPointer={false}
          />
        </LocaleProvider>
      </AuthSessionProvider>,
    );

    const filters = document.querySelector<HTMLElement>("[data-mobile-card-filters]");

    if (!filters) {
      throw new Error("Mobile card filters were not rendered.");
    }

    expect(filters).toHaveClass("sticky", "top-[-0.875rem]");
    expect(filters).not.toHaveClass("fixed");
  });

  it("shows one grid item for each card in the active and learned collections", () => {
    render(
      <AuthSessionProvider user={null}>
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
            onOpenImageTranslate={vi.fn()}
            onOpenCreate={vi.fn()}
            onOpenGroups={vi.fn()}
            showEmptyDeckPointer={false}
          />
        </LocaleProvider>
      </AuthSessionProvider>,
    );

    const visibleCards = Array.from(document.querySelectorAll<HTMLElement>("[data-mobile-vocabulary-card]"));
    expect(visibleCards).toHaveLength(2);
    expect(visibleCards.map((item) => item.getAttribute("aria-label"))).toEqual(
      expect.arrayContaining([card.term, learnedCard.term]),
    );
  });
});
