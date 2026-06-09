import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";

const appleCard = VOCABULARY_CARDS.find((card) => card.id === "en-a1-isim-apple")!;

describe("VocabularyCardView", () => {
  it("renders the front face by default", () => {
    const { container } = render(<VocabularyCardView card={appleCard} />);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: "apple" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "apple kartını çevir" })).not.toBeInTheDocument();
  });

  it("can start on the card back and reveal the front on click", async () => {
    const user = userEvent.setup();

    const { container } = render(<VocabularyCardView card={appleCard} initialFace="back" flippable />);

    const flipTarget = screen.getByRole("button", { name: "apple kartını çevir" });

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector('[data-card-back-tier="A1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-card-back-medallion="true"]')).toHaveTextContent("A1");
    expect(screen.getByText("Çevirmek için tıkla")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "apple" })).not.toBeInTheDocument();

    await user.click(flipTarget);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: "apple" })).toBeVisible();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("reveals the front with the %s key", async (_label, keyCommand) => {
    const user = userEvent.setup();

    const { container } = render(<VocabularyCardView card={appleCard} initialFace="back" flippable />);

    screen.getByRole("button", { name: "apple kartını çevir" }).focus();
    await user.keyboard(keyCommand);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: "apple" })).toBeVisible();
  });

  it("keeps card action buttons from triggering card flip behavior", async () => {
    const user = userEvent.setup();
    const addCard = vi.fn();

    const { container } = render(<VocabularyCardView card={appleCard} flippable onAdd={addCard} />);

    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(addCard).toHaveBeenCalledTimes(1);
    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
  });

  it("uses the first example sentence as a single-line preview", () => {
    const { container } = render(<VocabularyCardView card={appleCard} />);
    const examplePreview = screen.getByText(appleCard.examples[0]!.sentence);

    expect(examplePreview).toBeVisible();
    expect(examplePreview).toHaveClass("truncate");
    expect(container).not.toHaveTextContent("is useful in a clear sentence");
  });
});
