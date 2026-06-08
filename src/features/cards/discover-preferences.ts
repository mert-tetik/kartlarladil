import type { AuthProfile } from "@/features/auth/auth-types";
import type { LanguageCode, Tier } from "@/types/domain";

export const DISCOVER_PREFERENCES_KEY = "kartlarla-dil:discover-filters:v1";
const DISCOVER_PREFERENCES_EVENT = "kartlarla-dil:discover-filters-changed";

export type DiscoverLanguageFilter = LanguageCode | "all";
export type DiscoverTierFilter = Tier | "all";

export interface DiscoverPreferences {
  language: DiscoverLanguageFilter;
  tier: DiscoverTierFilter;
}

export const DEFAULT_DISCOVER_PREFERENCES: DiscoverPreferences = {
  language: "en",
  tier: "A1",
};

const LANGUAGE_FILTERS = new Set<DiscoverLanguageFilter>(["all", "en", "de", "ru"]);
const TIER_FILTERS = new Set<DiscoverTierFilter>(["all", "A1", "A2", "B1", "B2", "C1"]);

export function getDiscoverPreferenceFallback(profile?: AuthProfile | null): DiscoverPreferences {
  return {
    language: profile?.preferredLanguageCode ?? DEFAULT_DISCOVER_PREFERENCES.language,
    tier: profile?.preferredTier ?? DEFAULT_DISCOVER_PREFERENCES.tier,
  };
}

export function normalizeDiscoverPreferences(value: unknown, fallback = DEFAULT_DISCOVER_PREFERENCES) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<Record<keyof DiscoverPreferences, unknown>>;

  return {
    language:
      typeof candidate.language === "string" && LANGUAGE_FILTERS.has(candidate.language as DiscoverLanguageFilter)
        ? (candidate.language as DiscoverLanguageFilter)
        : fallback.language,
    tier:
      typeof candidate.tier === "string" && TIER_FILTERS.has(candidate.tier as DiscoverTierFilter)
        ? (candidate.tier as DiscoverTierFilter)
        : fallback.tier,
  };
}

export function readDiscoverPreferences(storage: Pick<Storage, "getItem">, profile?: AuthProfile | null) {
  const fallback = getDiscoverPreferenceFallback(profile);
  const raw = storage.getItem(DISCOVER_PREFERENCES_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    return normalizeDiscoverPreferences(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeDiscoverPreferences(storage: Pick<Storage, "setItem">, preferences: DiscoverPreferences) {
  storage.setItem(DISCOVER_PREFERENCES_KEY, JSON.stringify(normalizeDiscoverPreferences(preferences)));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DISCOVER_PREFERENCES_EVENT));
  }
}

export function subscribeDiscoverPreferences(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === DISCOVER_PREFERENCES_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(DISCOVER_PREFERENCES_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DISCOVER_PREFERENCES_EVENT, onStoreChange);
  };
}
