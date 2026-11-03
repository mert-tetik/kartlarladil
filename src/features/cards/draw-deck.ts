import type { CardDrawLanguageFilter, CardDrawTierFilter } from "@/features/cards/card-draw-preferences";
import type { Tier, VocabularyCard } from "@/types/domain";

export interface DrawDeckState {
  /** Card IDs that have not been drawn yet in the current cycle. */
  remaining: string[];
  /** Card IDs that have already been drawn in the current cycle. */
  drawn: string[];
  /** Identifies decks whose remaining cards follow the tier cycle. */
  tierOrderVersion?: 1;
}

type DrawDecksByFilter = Record<string, DrawDeckState>;

const DRAW_DECK_STORAGE_KEY = "foxiesdeck:draw-deck:v1";
const TIER_CYCLE: readonly Tier[] = ["A1", "A2", "B1", "B2", "C1"];

function getDeckKey(
  language: CardDrawLanguageFilter,
  tier: CardDrawTierFilter,
): string {
  return `${language}:${tier}`;
}

function readAllDecks(storage: Pick<Storage, "getItem">): DrawDecksByFilter {
  const raw = storage.getItem(DRAW_DECK_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as DrawDecksByFilter;
  } catch {
    return {};
  }
}

function writeAllDecks(
  storage: Pick<Storage, "setItem">,
  decks: DrawDecksByFilter,
): void {
  storage.setItem(DRAW_DECK_STORAGE_KEY, JSON.stringify(decks));
}

export function readDrawDeckState(
  storage: Pick<Storage, "getItem">,
  language: CardDrawLanguageFilter,
  tier: CardDrawTierFilter,
): DrawDeckState | null {
  return readAllDecks(storage)[getDeckKey(language, tier)] ?? null;
}

export function writeDrawDeckState(
  storage: Pick<Storage, "getItem" | "setItem">,
  language: CardDrawLanguageFilter,
  tier: CardDrawTierFilter,
  state: DrawDeckState,
): void {
  const decks = readAllDecks(storage);
  decks[getDeckKey(language, tier)] = state;
  writeAllDecks(storage, decks);
}

export function resetDrawDeckState(
  storage: Pick<Storage, "getItem" | "setItem">,
  language: CardDrawLanguageFilter,
  tier: CardDrawTierFilter,
): void {
  const decks = readAllDecks(storage);
  delete decks[getDeckKey(language, tier)];
  writeAllDecks(storage, decks);
}

function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleIdsInTierOrder(
  ids: readonly string[],
  cardsById: Map<string, VocabularyCard>,
): string[] {
  const buckets = new Map<Tier, string[]>(TIER_CYCLE.map((tier) => [tier, []]));

  for (const id of ids) {
    const card = cardsById.get(id);
    if (card) buckets.get(card.tier)?.push(id);
  }

  for (const tier of TIER_CYCLE) {
    const bucket = buckets.get(tier);
    if (bucket) buckets.set(tier, fisherYatesShuffle(bucket));
  }

  const ordered: string[] = [];
  let index = 0;
  let hasCards = true;

  while (hasCards) {
    hasCards = false;
    for (const tier of TIER_CYCLE) {
      const id = buckets.get(tier)?.[index];
      if (id) {
        ordered.push(id);
        hasCards = true;
      }
    }
    index += 1;
  }

  return ordered;
}

function buildEligibleIds(
  cards: readonly VocabularyCard[],
  excludedIds: Set<string>,
): Set<string> {
  const eligible = new Set<string>();
  for (const card of cards) {
    if (!excludedIds.has(card.id)) {
      eligible.add(card.id);
    }
  }
  return eligible;
}

function reconcileDeck(
  state: DrawDeckState | null,
  eligibleIds: Set<string>,
): DrawDeckState {
  const remaining = (state?.remaining ?? []).filter((id) => eligibleIds.has(id));
  const drawn = (state?.drawn ?? []).filter((id) => eligibleIds.has(id));
  return { remaining, drawn };
}

/**
 * Draws `count` cards from a cyclic deck.
 *
 * - Cards in `excludedIds` (e.g. the user's inventory) are never drawn.
 * - Once a card is drawn it moves to the `drawn` pile and will not be drawn
 *   again until the current cycle completes.
 * - When the remaining pile is empty, the drawn pile is shuffled and becomes
 *   the new remaining pile.
 */
export function drawCardsFromDeck(
  state: DrawDeckState | null,
  count: number,
  candidates: readonly VocabularyCard[],
  excludedIds: Set<string>,
): { cards: VocabularyCard[]; state: DrawDeckState } {
  const eligibleIds = buildEligibleIds(candidates, excludedIds);
  let { remaining, drawn } = reconcileDeck(state, eligibleIds);
  const cardsById = new Map(candidates.map((card) => [card.id, card]));

  // Cycle complete: randomize within each tier, then deal tiers in order.
  if (remaining.length === 0 && drawn.length > 0) {
    remaining = shuffleIdsInTierOrder(drawn, cardsById);
    drawn = [];
  }

  // Migrate older saved decks to the tier sequence without repeating drawn cards.
  if (remaining.length > 0 && state?.tierOrderVersion !== 1) {
    remaining = shuffleIdsInTierOrder(remaining, cardsById);
  }

  // First draw ever or the eligible pool changed completely: build a fresh deck.
  if (remaining.length === 0) {
    remaining = shuffleIdsInTierOrder([...eligibleIds], cardsById);
  }

  const drawCount = Math.min(count, remaining.length);
  const drawnIds = remaining.slice(0, drawCount);
  const nextRemaining = remaining.slice(drawCount);
  const nextDrawn = [...drawn, ...drawnIds];

  const cards = drawnIds
    .map((id) => candidates.find((card) => card.id === id))
    .filter((card): card is VocabularyCard => card !== undefined);

  return {
    cards,
    state: { remaining: nextRemaining, drawn: nextDrawn, tierOrderVersion: 1 },
  };
}

/**
 * Marks specific card IDs as already drawn so they will not reappear until
 * the deck cycles. Used when the user selects a card from search.
 */
export function markCardsAsDrawn(
  state: DrawDeckState | null,
  ids: string[],
): DrawDeckState {
  const current = state ?? { remaining: [], drawn: [] };
  const drawnSet = new Set([...current.drawn, ...ids]);
  return {
    remaining: current.remaining.filter((id) => !drawnSet.has(id)),
    drawn: [...drawnSet],
    ...(current.tierOrderVersion === 1 ? { tierOrderVersion: 1 as const } : {}),
  };
}
