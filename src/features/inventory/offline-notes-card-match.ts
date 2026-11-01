import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

type CardTermIdentity = Pick<VocabularyCard, "language" | "term" | "termKind">;
type GeneratedCardTermIdentity = Pick<GeneratedCardResponse, "language" | "term" | "termKind">;

export function getGeneratedCardTermKey(card: CardTermIdentity | GeneratedCardTermIdentity) {
  const normalizedTerm = card.term.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return JSON.stringify([
    card.language,
    card.termKind,
    normalizedTerm.toLocaleLowerCase(card.language),
  ]);
}

export function createDeckCardTermIndex(inventory: InventoryCard[]) {
  return new Set(
    joinInventoryCards(inventory).map(({ card }) => getGeneratedCardTermKey(card)),
  );
}

export function getDraftsNotInDeck<T extends { draft: { generated: GeneratedCardTermIdentity } }>(
  drafts: T[],
  deckTermIndex: ReadonlySet<string>,
) {
  return drafts.filter(({ draft }) => !deckTermIndex.has(getGeneratedCardTermKey(draft.generated)));
}

export function areOfflineNotesSafeToCloseWithoutConfirmation(input: {
  canCheckDeck: boolean;
  visibleNoteCount: number;
  addableDraftCount: number;
  hasPendingAdds: boolean;
}) {
  return input.canCheckDeck
    && input.visibleNoteCount === 0
    && input.addableDraftCount === 0
    && !input.hasPendingAdds;
}
