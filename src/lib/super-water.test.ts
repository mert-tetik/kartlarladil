import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";

describe("Super Water font helpers", () => {
  it("only enables the font for English and transliterated Turkish copy", () => {
    expect(canUseSuperWater("en")).toBe(true);
    expect(canUseSuperWater("tr")).toBe(true);
    expect(canUseSuperWater("de")).toBe(false);
    expect(canUseSuperWater("ja")).toBe(false);
  });

  it("converts Turkish-only glyphs to their ASCII equivalents", () => {
    expect(formatSuperWaterText("tr", "G\u00f6revler: \u00c7\u0131k\u0131\u015f")).toBe("Gorevler: Cikis");
    expect(formatSuperWaterText("en", "Games")).toBe("Games");
  });
});
