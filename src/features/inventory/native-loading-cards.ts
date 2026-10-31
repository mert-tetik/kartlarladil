import { VOCABULARY_CARDS } from "@/data/cards";
import { localCardRepository } from "@/features/cards/card-repository";
import { getCardTranslation } from "@/features/cards/card-localization";
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

const MAX_LOADING_CARDS = 4;

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
  return {
    sourceKey: card.sourceKey,
    term: card.term,
    translation: card.translations[locale] || card.translation,
    pronunciation: card.pronunciation || card.term,
    example: card.example,
    tier: card.tier,
  };
}

export function selectNativeLoadingOfflineCards(
  entries: OfflineInventoryEntry[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
  dateKey = getNativeLoadingDateKey(),
): NativeLoadingCard[] {
  const seedBase = `${dateKey}:${learningLanguage}`;
  const selected: OfflineInventoryEntry[] = [];
  const selectedKeys = new Set<string>();

  const activeEntries = shuffle(
    entries.filter((entry) =>
      entry.inventory.status !== "learned" && entry.card.language === learningLanguage,
    ),
    `${seedBase}:offline-deck`,
  );

  for (const entry of activeEntries) {
    if (selectedKeys.has(entry.card.sourceKey)) continue;
    selected.push(entry);
    selectedKeys.add(entry.card.sourceKey);
    if (selected.length === MAX_LOADING_CARDS) return selected.map((entry) => toOfflineLoadingCard(entry, locale));
  }

  const fallbackCards = selectNativeLoadingVocabularyCards([], learningLanguage, dateKey);
  for (const card of fallbackCards) {
    if (selectedKeys.has(card.sourceKey)) continue;
    selected.push({
      inventory: {
        cardId: card.sourceKey,
        status: "active",
        correctCount: 0,
        addedAt: "",
      },
      card: {
        id: card.id,
        sourceKey: card.sourceKey,
        language: card.language,
        tier: card.tier,
        termKind: card.termKind,
        term: card.term,
        translation: getCardTranslation(card, locale) || card.translation,
        translations: card.translations,
        pronunciation: card.pronunciation,
        partOfSpeech: card.partOfSpeech,
        example: card.examples[0]?.sentence || card.example,
      },
    });
    selectedKeys.add(card.sourceKey);
    if (selected.length === MAX_LOADING_CARDS) break;
  }

  return selected.map((entry) => toOfflineLoadingCard(entry, locale));
}

export function selectNativeLoadingVocabularyCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  dateKey = getNativeLoadingDateKey(),
): VocabularyCard[] {
  const selected: VocabularyCard[] = [];
  const selectedKeys = new Set<string>();
  const seedBase = `${dateKey}:${learningLanguage}`;

  const activeCards = shuffle(
    inventory
      .filter((entry) => entry.status !== "learned")
      .map((entry) => localCardRepository.findById(entry.cardId))
      .filter((card): card is VocabularyCard => card !== undefined && card.language === learningLanguage),
    `${seedBase}:deck`
  );

  for (const card of activeCards) {
    if (selectedKeys.has(card.sourceKey)) continue;
    selected.push(card);
    selectedKeys.add(card.sourceKey);
    if (selected.length === MAX_LOADING_CARDS) return selected;
  }

  const fallbackCards = shuffle(
    VOCABULARY_CARDS.filter(
      (card) => card.language === learningLanguage && card.termKind === "word",
    ),
    `${seedBase}:catalog`,
  );
  for (const card of fallbackCards) {
    if (selectedKeys.has(card.sourceKey)) continue;
    selected.push(card);
    selectedKeys.add(card.sourceKey);
    if (selected.length === MAX_LOADING_CARDS) break;
  }

  return selected;
}

export function selectNativeLoadingCards(
  inventory: InventoryCard[],
  learningLanguage: VocabularyCard["language"],
  locale: LocaleCode,
): NativeLoadingCard[] {
  return selectNativeLoadingVocabularyCards(inventory, learningLanguage).map((card) => toLoadingCard(card, locale));
}
