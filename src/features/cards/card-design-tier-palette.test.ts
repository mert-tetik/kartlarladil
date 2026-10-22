import { describe, expect, it } from "vitest";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";

describe("card design tier palettes", () => {
  it("preserves the original cyan gradient and accents for the blue A2 tier", () => {
    expect(getCardDesignTierPalette("A2")).toEqual({
      shellPrimary: "#72dce5",
      shellHighlight: "#b9f5ee",
      shellEnd: "#55c9d5",
      insetPrimary: "#75e2e7",
      insetMiddle: "#53c5d2",
      insetEnd: "#82e5df",
      badge: "#36b9ca",
      label: "#43b9ca",
    });
  });

  it("matches the green tier to the supplied fresh-green card reference", () => {
    expect(getCardDesignTierPalette("A1")).toEqual({
      shellPrimary: "#6bd38a",
      shellHighlight: "#a9e6a7",
      shellEnd: "#55c875",
      insetPrimary: "#78d78d",
      insetMiddle: "#49bd6b",
      insetEnd: "#9ce1a0",
      badge: "#52bf70",
      label: "#61c97b",
    });
  });

  it("uses the requested exact base colors for B1 and C1", () => {
    expect(getCardDesignTierPalette("B1").badge).toBe("#b163ff");
    expect(getCardDesignTierPalette("B1").shellEnd).toBe("#b163ff");
    expect(getCardDesignTierPalette("C1").badge).toBe("#fa5252");
    expect(getCardDesignTierPalette("C1").shellEnd).toBe("#fa5252");
  });

  it("gives every other tier a distinct, vivid color while retaining the palette structure", () => {
    const palettes = ["A1", "B1", "B2", "C1"].map((tier) => getCardDesignTierPalette(tier as "A1" | "B1" | "B2" | "C1"));

    expect(new Set(palettes.map((palette) => palette.badge)).size).toBe(4);
    for (const palette of palettes) {
      expect(palette.shellPrimary).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.shellHighlight).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.shellEnd).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.insetPrimary).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.insetMiddle).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.insetEnd).toMatch(/^#[\da-f]{6}$/i);
      expect(palette.label).toMatch(/^#[\da-f]{6}$/i);
    }
  });

  it("preserves requested B1 and keeps its bright gradient tied to the tier color", () => {
    const palette = getCardDesignTierPalette("B1");

    expect(palette.badge).toBe("#b163ff");
    expect(palette.shellEnd).toBe(palette.badge);
    expect(palette.shellHighlight).toBe("#bf7fff");
    expect(palette.insetEnd).toBe(palette.shellHighlight);
    expect(palette.shellHighlight).not.toBe("#ddd0ff");

    for (const tier of ["B2"] as const) {
      const color = getCardDesignTierPalette(tier).badge;
      const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
      expect(Math.min(...channels) === 0 || Math.max(...channels) === 255).toBe(true);
    }
  });
});
