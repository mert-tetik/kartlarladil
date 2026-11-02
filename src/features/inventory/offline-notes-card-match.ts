import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { InventoryCard, LanguageCode, VocabularyCard } from "@/types/domain";

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

export function getDraftsBlockedByActiveCardLimit<
  T extends { draft: { generated: Pick<GeneratedCardTermIdentity, "language"> } },
>(
  drafts: readonly T[],
  inventory: readonly InventoryCard[],
  perLanguageLimit: number | null,
): T[] {
  if (perLanguageLimit === null) return [];

  const activeCounts = new Map<LanguageCode, number>();
  for (const { inventory: ownedCard, card } of joinInventoryCards([...inventory])) {
    if (ownedCard.status !== "active") continue;
    activeCounts.set(card.language, (activeCounts.get(card.language) ?? 0) + 1);
  }

  const blockedDrafts: T[] = [];
  for (const entry of drafts) {
    const language = entry.draft.generated.language;
    const currentCount = activeCounts.get(language) ?? 0;
    if (currentCount >= perLanguageLimit) {
      blockedDrafts.push(entry);
      continue;
    }

    activeCounts.set(language, currentCount + 1);
  }

  return blockedDrafts;
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
