import { VOCABULARY_CARDS } from "@/data/cards";
import { localCardRepository } from "@/features/cards/card-repository";
import { getCardTranslation } from "@/features/cards/card-localization";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import type { OfflineInventoryEntry } from "@/features/inventory/offline-inventory-snapshot";
import type { InventoryCard, LocaleCode, VocabularyCard } from "@/types/domain";

export interface NativeLoadingCard {
  sourceKey: string;
  term: string;
  translation: string;
  pronunciation: string;
  example: string;
  tier: VocabularyCard["tier"];
}

const MAX_LOADING_CARDS = 8;

export function getNativeLoadingDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createSeededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: string) {
  const shuffled = [...items];
  const random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function toLoadingCard(card: VocabularyCard, locale: LocaleCode): NativeLoadingCard {
  return {
    sourceKey: card.sourceKey,
    term: card.term,
    translation: getCardTranslation(card, locale) || card.translation,
    pronunciation: card.pronunciation || card.term,
    example: card.examples[0]?.sentence || card.example,
    tier: card.tier,
  };
}

function toOfflineLoadingCard(entry: OfflineInventoryEntry, locale: LocaleCode): NativeLoadingCard {
  const card = entry.card;
  const catalogCard = localCardRepository.findById(card.id) ?? localCardRepository.findById(card.sourceKey);
  return {
    sourceKey: card.sourceKey,
    term: card.term,
    translation: card.translations[locale] || (catalogCard ? getCardTranslation(catalogCard, locale) : "") || card.translation,
    pronunciation: card.pronunciation || catalogCard?.pronunciation || card.term,
    example: catalogCard?.examples[0]?.sentence || card.example,
    tier: card.tier,
  };
}

function findDeckCard(cardId: string): VocabularyCard | undefined {
  return localCardRepository.findById(cardId)
    ?? customCardRegistry.findBySourceKey(cardId)
    ?? VOCABULARY_CARDS.find((card) => card.sourceKey === cardId);
}

function selectInventoryDeckCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  dateKey: string,
  seedScope: string,
) {
  const activeCards: VocabularyCard[] = [];
  const learnedCards: VocabularyCard[] = [];
  const seenKeys = new Set<string>();

  for (const entry of inventory) {
    const card = findDeckCard(entry.cardId);
    if (!card || card.language !== learningLanguage || seenKeys.has(card.sourceKey)) continue;
    seenKeys.add(card.sourceKey);
    (entry.status === "learned" ? learnedCards : activeCards).push(card);
  }

  const seedBase = `${dateKey}:${learningLanguage}:${seedScope}`;
  return [
    ...shuffle(activeCards, `${seedBase}:active`),
    ...shuffle(learnedCards, `${seedBase}:learned`),
  ].slice(0, MAX_LOADING_CARDS);
}

function selectOfflineDeckEntries(
  entries: OfflineInventoryEntry[],
  learningLanguage: VocabularyCard["language"],
  dateKey: string,
  seedScope: string,
) {
  const matchingEntries = entries.filter((entry) => entry.card.language === learningLanguage);
  const activeEntries = matchingEntries.filter((entry) => entry.inventory.status !== "learned");
  const learnedEntries = matchingEntries.filter((entry) => entry.inventory.status === "learned");
  const seedBase = `${dateKey}:${learningLanguage}:${seedScope}:offline`;
  const selected: OfflineInventoryEntry[] = [];
  const seenKeys = new Set<string>();

  for (const entry of [
    ...shuffle(activeEntries, `${seedBase}:active`),
    ...shuffle(learnedEntries, `${seedBase}:learned`),
  ]) {
    if (seenKeys.has(entry.card.sourceKey)) continue;
    selected.push(entry);
    seenKeys.add(entry.card.sourceKey);
    if (selected.length >= MAX_LOADING_CARDS) break;
  }

  return selected;
}

function selectCatalogFallbackCards(
  selectedKeys: ReadonlySet<string>,
  learningLanguage: VocabularyCard["language"],
  dateKey: string,
) {
  return shuffle(
    VOCABULARY_CARDS.filter((card) => card.language === learningLanguage && card.termKind === "word"),
    `${dateKey}:${learningLanguage}:catalog`,
  ).filter((card) => !selectedKeys.has(card.sourceKey));
}

export function selectNativeLoadingDeckCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
  dateKey = getNativeLoadingDateKey(),
  seedScope = "deck",
): NativeLoadingCard[] {
  return selectInventoryDeckCards(inventory, learningLanguage, dateKey, seedScope)
    .map((card) => toLoadingCard(card, locale));
}

export function selectNativeLoadingOfflineDeckCards(
  entries: OfflineInventoryEntry[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
  dateKey = getNativeLoadingDateKey(),
  seedScope = "deck",
): NativeLoadingCard[] {
  return selectOfflineDeckEntries(entries, learningLanguage, dateKey, seedScope)
    .map((entry) => toOfflineLoadingCard(entry, locale));
}

export function completeNativeLoadingCards(
  deckCards: NativeLoadingCard[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
  dateKey = getNativeLoadingDateKey(),
): NativeLoadingCard[] {
  const selected = deckCards.slice(0, MAX_LOADING_CARDS);
  const selectedKeys = new Set(selected.map((card) => card.sourceKey));

  for (const card of selectCatalogFallbackCards(selectedKeys, learningLanguage, dateKey)) {
    selected.push(toLoadingCard(card, locale));
    selectedKeys.add(card.sourceKey);
    if (selected.length >= MAX_LOADING_CARDS) break;
  }

  return selected;
}

export function selectNativeLoadingOfflineCards(
  entries: OfflineInventoryEntry[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
  dateKey = getNativeLoadingDateKey(),
): NativeLoadingCard[] {
  return completeNativeLoadingCards(
    selectNativeLoadingOfflineDeckCards(entries, learningLanguage, locale, dateKey),
    learningLanguage,
    locale,
    dateKey,
  );
}

export function selectNativeLoadingVocabularyCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  dateKey = getNativeLoadingDateKey(),
  seedScope = "deck",
): VocabularyCard[] {
  const selected = selectInventoryDeckCards(inventory, learningLanguage, dateKey, seedScope);
  const selectedKeys = new Set(selected.map((card) => card.sourceKey));
  for (const card of selectCatalogFallbackCards(selectedKeys, learningLanguage, dateKey)) {
    selected.push(card);
    selectedKeys.add(card.sourceKey);
    if (selected.length >= MAX_LOADING_CARDS) break;
  }
  return selected;
}

export function selectNativeLoadingVocabularyCardsFromDeckCache(
  deckCards: NativeLoadingCard[],
  learningLanguage: VocabularyCard["language"],
  dateKey = getNativeLoadingDateKey(),
): VocabularyCard[] {
  const selected: VocabularyCard[] = [];
  const selectedKeys = new Set<string>();

  for (const cachedCard of deckCards.slice(0, MAX_LOADING_CARDS)) {
    const card = findDeckCard(cachedCard.sourceKey);
    if (!card || card.language !== learningLanguage || selectedKeys.has(card.sourceKey)) continue;
    selected.push(card);
    selectedKeys.add(card.sourceKey);
  }

  for (const card of selectCatalogFallbackCards(selectedKeys, learningLanguage, dateKey)) {
    selected.push(card);
    selectedKeys.add(card.sourceKey);
    if (selected.length >= MAX_LOADING_CARDS) break;
  }

  return selected;
}

export function selectNativeLoadingCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
): NativeLoadingCard[] {
  const dateKey = getNativeLoadingDateKey();
  const deckCards = selectNativeLoadingDeckCards(inventory, learningLanguage, locale, dateKey);
  return completeNativeLoadingCards(deckCards, learningLanguage, locale, dateKey);
}
