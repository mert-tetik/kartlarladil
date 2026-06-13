import {
  CARD_DRAW_PREFERENCES_KEY,
  DEFAULT_CARD_DRAW_PREFERENCES,
  getCardDrawPreferenceFallback,
  normalizeCardDrawPreferences,
  readCardDrawPreferences,
  writeCardDrawPreferences,
} from "@/features/cards/card-draw-preferences";

describe("card draw preferences", () => {
  it("defaults to English A1", () => {
    expect(DEFAULT_CARD_DRAW_PREFERENCES).toEqual({
      language: "en",
      tier: "A1",
    });
  });

  it("uses profile preferences as fallback", () => {
    expect(
      getCardDrawPreferenceFallback({
        displayName: null,
        preferredLanguageCode: "de",
        preferredUiLocale: "tr",
        preferredTier: "B2",
      }),
    ).toEqual({
      language: "de",
      tier: "B2",
    });
  });

  it("normalizes invalid saved values", () => {
    expect(normalizeCardDrawPreferences({ language: "xx", tier: "Z9" })).toEqual(DEFAULT_CARD_DRAW_PREFERENCES);
  });

  it("reads and writes storage values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeCardDrawPreferences(storage, { language: "ru", tier: "C1" });

    expect(values.has(CARD_DRAW_PREFERENCES_KEY)).toBe(true);
    expect(readCardDrawPreferences(storage)).toEqual({ language: "ru", tier: "C1" });
  });
});
