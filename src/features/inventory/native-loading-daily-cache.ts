import { getNativeLoadingDateKey, type NativeLoadingCard } from "@/features/inventory/native-loading-cards";
import type { LanguageCode, LocaleCode } from "@/types/domain";

const STORAGE_KEY_PREFIX = "foxiesdeck:native-loading-daily:v1";
const MAX_LOADING_CARDS = 8;
const VALID_TIERS = new Set(["A1", "A2", "B1", "B2", "C1"]);

export interface NativeLoadingDailyCacheIdentity {
  profileId: string;
  learningLanguage: LanguageCode;
  locale: LocaleCode;
  dateKey?: string;
}

interface NativeLoadingDailyCacheRecord {
  schemaVersion: 1;
  profileId: string;
  learningLanguage: LanguageCode;
  locale: LocaleCode;
  dateKey: string;
  cards: NativeLoadingCard[];
}

function getDateKey(identity: NativeLoadingDailyCacheIdentity) {
  return identity.dateKey ?? getNativeLoadingDateKey();
}

function getScopeKey(identity: NativeLoadingDailyCacheIdentity) {
  return [
    STORAGE_KEY_PREFIX,
    encodeURIComponent(identity.profileId),
    identity.learningLanguage,
    identity.locale,
  ].join(":");
}

function getStorageKey(identity: NativeLoadingDailyCacheIdentity) {
  return `${getScopeKey(identity)}:${getDateKey(identity)}`;
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseCard(value: unknown): NativeLoadingCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Partial<NativeLoadingCard>;
  if (
    typeof card.sourceKey !== "string" || card.sourceKey.length === 0 || card.sourceKey.length > 512 ||
    typeof card.term !== "string" || card.term.length === 0 || card.term.length > 1000 ||
    typeof card.translation !== "string" || card.translation.length > 1000 ||
    typeof card.pronunciation !== "string" || card.pronunciation.length > 500 ||
    typeof card.example !== "string" || card.example.length > 4000 ||
    typeof card.tier !== "string" || !VALID_TIERS.has(card.tier)
  ) {
    return null;
  }

  return {
    sourceKey: card.sourceKey,
    term: card.term,
    translation: card.translation,
    pronunciation: card.pronunciation,
    example: card.example,
    tier: card.tier as NativeLoadingCard["tier"],
  };
}

export function readNativeLoadingDailyDeckCards(
  identity: NativeLoadingDailyCacheIdentity,
  storage = getBrowserStorage(),
): NativeLoadingCard[] | null {
  if (!storage) return null;

  try {
    const serialized = storage.getItem(getStorageKey(identity));
    if (!serialized) return null;

    const value = JSON.parse(serialized) as Partial<NativeLoadingDailyCacheRecord>;
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.profileId !== identity.profileId ||
      value.learningLanguage !== identity.learningLanguage ||
      value.locale !== identity.locale ||
      value.dateKey !== getDateKey(identity) ||
      !Array.isArray(value.cards) ||
      value.cards.length > MAX_LOADING_CARDS
    ) {
      return null;
    }

    const cards = value.cards.map(parseCard);
    if (cards.some((card) => card === null)) return null;
    const parsedCards = cards as NativeLoadingCard[];
    if (new Set(parsedCards.map((card) => card.sourceKey)).size !== parsedCards.length) return null;

    return parsedCards;
  } catch {
    return null;
  }
}

export function saveNativeLoadingDailyDeckCards(
  identity: NativeLoadingDailyCacheIdentity,
  cards: NativeLoadingCard[],
  storage = getBrowserStorage(),
) {
  if (!storage) return false;

  const selectedCards = cards.slice(0, MAX_LOADING_CARDS);
  if (
    selectedCards.some((card) => parseCard(card) === null) ||
    new Set(selectedCards.map((card) => card.sourceKey)).size !== selectedCards.length
  ) {
    return false;
  }

  const record: NativeLoadingDailyCacheRecord = {
    schemaVersion: 1,
    profileId: identity.profileId,
    learningLanguage: identity.learningLanguage,
    locale: identity.locale,
    dateKey: getDateKey(identity),
    cards: selectedCards,
  };

  try {
    storage.setItem(getStorageKey(identity), JSON.stringify(record));

    // Keep only the current day's tiny cache for this exact user/language/locale.
    const scopeKey = `${getScopeKey(identity)}:`;
    const currentKey = getStorageKey(identity);
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(scopeKey) && key !== currentKey) storage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function getOrCreateNativeLoadingDailyDeckCards(
  identity: NativeLoadingDailyCacheIdentity,
  selectDeckCards: () => NativeLoadingCard[],
): NativeLoadingCard[] {
  const cachedCards = readNativeLoadingDailyDeckCards(identity);
  if (cachedCards !== null) return cachedCards;

  const selectedCards = selectDeckCards().slice(0, MAX_LOADING_CARDS);
  saveNativeLoadingDailyDeckCards(identity, selectedCards);
  return readNativeLoadingDailyDeckCards(identity) ?? selectedCards;
}
