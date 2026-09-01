import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCardGroupSheet } from "@/app/components/mobile-card-group-sheet";
import { getCardsForGroup } from "@/features/cards/card-groups";
import { LocaleProvider } from "@/i18n/locale-provider";

const { inventoryState } = vi.hoisted(() => ({
  inventoryState: {
    cards: [] as Array<{ cardId: string }>,
    addCards: vi.fn(async (cardIds: string[]) => ({
      ok: true,
      firstCardAdded: false,
      addedCardIds: cardIds,
      remainingCardIds: [] as string[],
      limitReached: false,
    })),
  },
}));

vi.mock("@/components/mobile-bottom-sheet-shell", () => ({
  MobileBottomSheetShell: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <section aria-label={title}>{children}</section> : null,
}));

vi.mock("@/app/components/mobile-card-display-sheet", () => ({
  MobileCardDisplaySheet: ({ card, isOpen }: { card: { term: string } | null; isOpen: boolean }) =>
    card && isOpen ? <div data-mobile-card-display-sheet>{card.term}</div> : null,
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: typeof inventoryState) => unknown) => selector(inventoryState),
}));

describe("MobileCardGroupSheet", () => {
  beforeEach(() => {
    inventoryState.cards = [];
    inventoryState.addCards.mockClear();
  });

  it("renders localized groups and sends the selected group's cards to inventory", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="en">
        <MobileCardGroupSheet open onClose={vi.fn()} language="en" />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: "School" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Technology" })).toBeInTheDocument();

    const schoolToggle = screen.getByRole("button", { name: /SchoolWords about School/ });
    expect(schoolToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(schoolToggle);
    expect(schoolToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("school")).toBeInTheDocument();

    await user.click(screen.getByText("school"));
    const cardDisplay = document.querySelector("[data-mobile-card-display-sheet]");
    expect(cardDisplay).toBeInTheDocument();
    expect(cardDisplay?.parentElement).toBe(document.body);

    await user.click(screen.getByRole("button", { name: "School Add group" }));
    const confirmationDialog = await screen.findByRole("dialog");
    expect(confirmationDialog.parentElement).toHaveClass("fixed", "inset-0", "z-[100]");
    expect(screen.getByText(/cards from this group will be added to your deck/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("bg-red-600");
    expect(screen.getByRole("button", { name: "Yes, add" })).toHaveClass("bg-blue-600");
    expect(inventoryState.addCards).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "School" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "School Add group" }));
    await user.click(screen.getByRole("button", { name: "Yes, add" }));

    await waitFor(() => {
      expect(inventoryState.addCards).toHaveBeenCalledOnce();
    });
    expect(inventoryState.addCards.mock.calls[0]?.[0].length).toBeGreaterThan(0);
  });

  it("adds an individual card from an expanded group", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="en">
        <MobileCardGroupSheet open onClose={vi.fn()} language="en" />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: /SchoolWords about School/ }));
    const addCardButton = screen.getAllByRole("button", { name: /Add to cards/ })[0];

    expect(addCardButton).toHaveClass("bg-background-card");
    expect(addCardButton).not.toHaveClass("bg-[var(--tier-a1)]");
    await user.click(addCardButton);

    await waitFor(() => {
      expect(inventoryState.addCards).toHaveBeenCalledOnce();
    });
    expect(inventoryState.addCards.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("reports how many group cards were blocked by the active card limit", async () => {
    const user = userEvent.setup();
    const onSubscriptionLimitReached = vi.fn();
    inventoryState.addCards.mockResolvedValueOnce({
      ok: true,
      firstCardAdded: false,
      addedCardIds: ["added-card"],
      remainingCardIds: ["blocked-card"],
      limitReached: true,
    });

    render(
      <LocaleProvider initialLocale="en">
        <MobileCardGroupSheet
          open
          onClose={vi.fn()}
          language="en"
          onSubscriptionLimitReached={onSubscriptionLimitReached}
        />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "School Add group" }));
    await user.click(screen.getByRole("button", { name: "Yes, add" }));

    await waitFor(() => {
      expect(onSubscriptionLimitReached).toHaveBeenCalledWith("free_active_card_limit", {
        addedCount: 1,
        skippedCount: 1,
      });
    });
  });

  it("shows the collection tick for cards already in the deck", async () => {
    const user = userEvent.setup();
    const schoolCard = getCardsForGroup("school", "en")[0];
    inventoryState.cards = [{ cardId: schoolCard.sourceKey }];

    render(
      <LocaleProvider initialLocale="en">
        <MobileCardGroupSheet open onClose={vi.fn()} language="en" />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: /SchoolWords about School/ }));

    expect(screen.getByRole("img", { name: "In deck" })).toBeInTheDocument();
  });
});
