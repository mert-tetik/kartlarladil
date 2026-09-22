import {
  canUseSuperWater,
  formatSuperWaterText,
  formatSuperWaterUppercaseText,
} from "@/lib/super-water";

describe("Super Water font helpers", () => {
  it("enables the font for supported Latin-script UI locales only", () => {
    expect(canUseSuperWater("en")).toBe(true);
    expect(canUseSuperWater("tr")).toBe(true);
    expect(canUseSuperWater("de")).toBe(true);
    expect(canUseSuperWater("fr")).toBe(true);
    expect(canUseSuperWater("es")).toBe(true);
    expect(canUseSuperWater("it")).toBe(true);
    expect(canUseSuperWater("pt")).toBe(true);
    expect(canUseSuperWater("nl")).toBe(true);
    expect(canUseSuperWater("pl")).toBe(true);
    expect(canUseSuperWater("ru")).toBe(false);
    expect(canUseSuperWater("ja")).toBe(false);
  });

  it("preserves characters supported by the font and normalizes unsupported Latin characters", () => {
    expect(formatSuperWaterText("tr", "G\u00f6revler: \u00c7\u0131k\u0131\u015f")).toBe("G\u00f6revler: \u00c7\u0131k\u0131s");
    expect(formatSuperWaterText("de", "Gr\u00f6\u00dfe & Stra\u00dfe")).toBe("Gr\u00f6\u00dfe & Stra\u00dfe");
    expect(formatSuperWaterText("fr", "C\u0153ur d\u00e9j\u00e0")).toBe("C\u0153ur d\u00e9j\u00e0");
    expect(formatSuperWaterText("pl", "Za\u017c\u00f3\u0142\u0107 g\u0119\u015bl\u0105 ja\u017a\u0144")).toBe("Zaz\u00f3\u0142c gesla jazn");
    expect(formatSuperWaterText("en", "Games")).toBe("Games");
    expect(formatSuperWaterText("ru", "\u0418\u0433\u0440\u044b")).toBe("\u0418\u0433\u0440\u044b");
    expect(formatSuperWaterText("tr", "\u0130LK AY \u00dcCRETS\u0130Z")).toBe("ILK AY \u00dcCRETSIZ");
  });

  it("uppercases before formatting so Turkish labels keep Super Water compatibility", () => {
    expect(formatSuperWaterUppercaseText("tr", "Al\u0131nd\u0131")).toBe("ALINDI");
    expect(formatSuperWaterUppercaseText("tr", "\u0130ptal")).toBe("IPTAL");
  });
});
