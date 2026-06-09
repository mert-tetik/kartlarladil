import type { AuthProfile } from "@/features/auth/auth-types";
import type { LanguageCode, Tier } from "@/types/domain";

export const CARD_DRAW_PREFERENCES_KEY = "kartlarla-dil:card-draw-filters:v1";
const CARD_DRAW_PREFERENCES_EVENT = "kartlarla-dil:card-draw-filters-changed";

export type CardDrawLanguageFilter = LanguageCode | "all";
export type CardDrawTierFilter = Tier | "all";

export interface CardDrawPreferences {
  language: CardDrawLanguageFilter;
  tier: CardDrawTierFilter;
}

export const DEFAULT_CARD_DRAW_PREFERENCES: CardDrawPreferences = {
  language: "en",
  tier: "A1",
};

const LANGUAGE_FILTERS = new Set<CardDrawLanguageFilter>(["all", "en", "de", "ru"]);
const TIER_FILTERS = new Set<CardDrawTierFilter>(["all", "A1", "A2", "B1", "B2", "C1"]);

export function getCardDrawPreferenceFallback(profile?: AuthProfile | null): CardDrawPreferences {
  return {
    language: profile?.preferredLanguageCode ?? DEFAULT_CARD_DRAW_PREFERENCES.language,
    tier: profile?.preferredTier ?? DEFAULT_CARD_DRAW_PREFERENCES.tier,
  };
}

export function normalizeCardDrawPreferences(value: unknown, fallback = DEFAULT_CARD_DRAW_PREFERENCES) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<Record<keyof CardDrawPreferences, unknown>>;

  return {
    language:
      typeof candidate.language === "string" && LANGUAGE_FILTERS.has(candidate.language as CardDrawLanguageFilter)
        ? (candidate.language as CardDrawLanguageFilter)
        : fallback.language,
    tier:
      typeof candidate.tier === "string" && TIER_FILTERS.has(candidate.tier as CardDrawTierFilter)
        ? (candidate.tier as CardDrawTierFilter)
        : fallback.tier,
  };
}

export function readCardDrawPreferences(storage: Pick<Storage, "getItem">, profile?: AuthProfile | null) {
  const fallback = getCardDrawPreferenceFallback(profile);
  const raw = storage.getItem(CARD_DRAW_PREFERENCES_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    return normalizeCardDrawPreferences(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeCardDrawPreferences(storage: Pick<Storage, "setItem">, preferences: CardDrawPreferences) {
  storage.setItem(CARD_DRAW_PREFERENCES_KEY, JSON.stringify(normalizeCardDrawPreferences(preferences)));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CARD_DRAW_PREFERENCES_EVENT));
  }
}

export function subscribeCardDrawPreferences(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === CARD_DRAW_PREFERENCES_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CARD_DRAW_PREFERENCES_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CARD_DRAW_PREFERENCES_EVENT, onStoreChange);
  };
}
