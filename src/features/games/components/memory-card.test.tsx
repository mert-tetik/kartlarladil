import { render, screen } from "@testing-library/react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LocaleProvider } from "@/i18n/locale-provider";
import { MemoryCard } from "@/features/games/components/memory-card";

const card = VOCABULARY_CARDS.find((entry) => entry.language === "ja" && entry.tier === "B1")!;

describe("MemoryCard game-specific design", () => {
  it("keeps the existing game back and front visual treatment instead of the shared vocabulary-card design", () => {
    const { container, rerender } = render(
      <LocaleProvider initialLocale="en">
        <MemoryCard
          item={{ id: "memory-test", card, pairId: "pair-1", isFlipped: false, isMatched: false }}
          onClick={() => undefined}
          disabled={false}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: "Reveal memory card" })).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector(".fd-card-design")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='memory-cards/B1.png']")).toBeInTheDocument();

    rerender(
      <LocaleProvider initialLocale="en">
        <MemoryCard
          item={{ id: "memory-test", card, pairId: "pair-1", isFlipped: true, isMatched: false }}
          onClick={() => undefined}
          disabled={false}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: card.term })).toHaveAttribute("data-card-face", "front");
    expect(container.querySelector(".fd-card-design")).not.toBeInTheDocument();
  });
});
