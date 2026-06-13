import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getCardTranslation } from "@/features/cards/card-localization";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;

describe("VocabularyCardView", () => {
  it("renders the front face by default", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} />);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
    expect(screen.getByLabelText("10 puan")).toBeVisible();
    expect(screen.queryByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` })).not.toBeInTheDocument();
  });

  it("can start on the card back and reveal the front on click", async () => {
    const user = userEvent.setup();

    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" flippable />);

    const flipTarget = screen.getByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` });

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector('[data-card-back-tier="A1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-card-back-medallion="true"]')).toHaveTextContent("A1");
    expect(screen.getByText("Çevirmek için tıkla")).toBeVisible();
    expect(screen.queryByRole("heading", { name: testCard.term })).not.toBeInTheDocument();

    await user.click(flipTarget);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
  });

  it("can override the displayed tier on the card back", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" backDisplayTier="C1" />);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector('[data-card-back-tier="C1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-card-back-medallion="true"]')).toHaveTextContent("C1");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("reveals the front with the %s key", async (_label, keyCommand) => {
    const user = userEvent.setup();

    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" flippable />);

    screen.getByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` }).focus();
    await user.keyboard(keyCommand);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
  });

  it("keeps card action buttons from triggering card flip behavior", async () => {
    const user = userEvent.setup();
    const addCard = vi.fn();

    const { container } = renderCard(<VocabularyCardView card={testCard} flippable onAdd={addCard} />);

    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(addCard).toHaveBeenCalledTimes(1);
    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
  });

  it("uses the first example sentence as a single-line preview", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} />);
    const examplePreview = screen.getByText(testCard.examples[0]!.sentence);

    expect(examplePreview).toBeVisible();
    expect(examplePreview).toHaveClass("truncate");
    expect(container).not.toHaveTextContent("is useful in a clear sentence");
    expect(container).toHaveTextContent(getCardTranslation(testCard, "tr"));
  });
});

function renderCard(ui: ReactElement) {
  return render(<LocaleProvider initialLocale="tr">{ui}</LocaleProvider>);
}
