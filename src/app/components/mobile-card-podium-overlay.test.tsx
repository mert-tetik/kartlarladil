import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileCardPodiumOverlay } from "@/app/components/mobile-card-podium-overlay";
import { VOCABULARY_CARDS } from "@/data/cards";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";

const { inventoryState, closeMock, vibrateMock, playSoundEffectMock } = vi.hoisted(() => ({
  inventoryState: {
    loadCloudInventory: vi.fn(),
    optimisticallyRemoveCard: vi.fn(),
    optimisticallyMarkCardLearned: vi.fn(),
    settleOptimisticCardMutation: vi.fn(),
    rollbackOptimisticCardMutation: vi.fn(),
  },
  closeMock: vi.fn(),
  vibrateMock: vi.fn(),
  playSoundEffectMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: ({ card }: { card: { id: string } }) => <div data-testid={`card-${card.id}`} />,
}));

vi.mock("@/features/cards/components/card-grammar-details-overlay", () => ({
  CardGrammarDetailsButton: () => null,
  CardGrammarDetailsOverlay: () => null,
}));

vi.mock("@/features/ask/components/ask-overlay-provider", () => ({
  useAskOverlay: () => ({ openAsk: vi.fn() }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
  useAuthSession: () => ({
    user: null,
    refreshProfile: vi.fn(),
    reserveGemSpend: vi.fn(),
    settleGemSpend: vi.fn(),
    rollbackGemSpend: vi.fn(),
  }),
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: typeof inventoryState) => unknown) => selector(inventoryState),
}));

vi.mock("@/components/app-message-provider", () => ({
  useAppMessage: () => ({ showMessage: vi.fn() }),
}));

vi.mock("@/data/card-definitions", () => ({ getCardDefinition: () => null }));
vi.mock("@/features/cards/card-localization", () => ({ getStudyLocale: () => "en" }));
vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "tr" }),
  useT: () => (key: string) => key,
}));
vi.mock("@/features/gems/gem-actions", () => ({
  markCardLearnedWithGemAction: vi.fn(),
  removeCardWithGemAction: vi.fn(),
}));
vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: playSoundEffectMock }));
vi.mock("@/lib/vibration", () => ({ vibrate: vibrateMock }));

const activeCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
const learnedCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.id !== activeCard.id)!;

function makeItem(card: typeof activeCard, status: "active" | "learned"): InventoryCardView {
  return {
    card,
    inventory: {
      cardId: card.id,
      status,
      correctCount: status === "learned" ? 8 : 0,
      addedAt: "2026-07-20T00:00:00.000Z",
    },
  } as InventoryCardView;
}

describe("MobileCardPodiumOverlay review flow", () => {
  it("closes through the normal overlay close path after the final learned card is tapped", async () => {
    render(
      <MobileCardPodiumOverlay
        items={[]}
        reviewActiveItems={[makeItem(activeCard, "active")]}
        reviewLearnedItems={[makeItem(learnedCard, "learned")]}
        selectedCardId={activeCard.id}
        isOpen
        onSelectedCardChange={vi.fn()}
        onClose={closeMock}
        mode="review"
      />,
    );

    await waitFor(() => expect(document.querySelector("[data-mobile-card-podium-overlay]")).toBeInTheDocument());
    const main = document.querySelector("[data-mobile-card-podium-overlay] main");
    if (!main) throw new Error("Review screen main area was not rendered.");

    fireEvent.click(main); // Reveal active cards.
    fireEvent.click(main); // Move from the final active card to the learned section.
    expect(closeMock).not.toHaveBeenCalled();

    fireEvent.click(main); // Reveal learned cards.
    await act(async () => {});
    fireEvent.click(main); // Final learned card closes the overlay.

    expect(closeMock).toHaveBeenCalledOnce();
    expect(vibrateMock).toHaveBeenCalledTimes(3);
    expect(playSoundEffectMock).toHaveBeenCalledTimes(3);
  });
});
