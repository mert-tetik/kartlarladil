import { describe, expect, it } from "vitest";
import {
  DISCOVER_PREFERENCES_KEY,
  DEFAULT_DISCOVER_PREFERENCES,
  getDiscoverPreferenceFallback,
  normalizeDiscoverPreferences,
  readDiscoverPreferences,
  writeDiscoverPreferences,
} from "@/features/cards/discover-preferences";

describe("discover preferences", () => {
  it("defaults to English A1", () => {
    expect(DEFAULT_DISCOVER_PREFERENCES).toEqual({
      language: "en",
      tier: "A1",
    });
  });

  it("uses profile preferences as fallback", () => {
    expect(
      getDiscoverPreferenceFallback({
        displayName: null,
        preferredLanguageCode: "de",
        preferredTier: "B2",
      }),
    ).toEqual({
      language: "de",
      tier: "B2",
    });
  });

  it("normalizes invalid saved values", () => {
    expect(normalizeDiscoverPreferences({ language: "fr", tier: "Z9" })).toEqual(DEFAULT_DISCOVER_PREFERENCES);
  });

  it("reads and writes storage values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeDiscoverPreferences(storage, { language: "ru", tier: "C1" });

    expect(values.has(DISCOVER_PREFERENCES_KEY)).toBe(true);
    expect(readDiscoverPreferences(storage)).toEqual({ language: "ru", tier: "C1" });
  });
});
