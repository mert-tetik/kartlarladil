import { describe, expect, it } from "vitest";
import { getAccessibleForeground } from "@/lib/color-contrast";
import { THEMES } from "@/lib/themes";

function luminance(hex: string) {
  const normalized = hex.replace(/^#/, "");
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: number, second: number) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("getAccessibleForeground", () => {
  it.each(THEMES.map((theme) => [theme.id, theme.brand] as const))(
    "chooses the higher-contrast text color for the %s brand",
    (_themeId, brand) => {
      const foreground = getAccessibleForeground(brand);
      const foregroundLuminance = luminance(foreground);

      const selectedContrast = contrastRatio(luminance(brand), foregroundLuminance);
      expect(selectedContrast).toBeGreaterThanOrEqual(4.5);
      expect(selectedContrast).toBeGreaterThanOrEqual(
        contrastRatio(luminance(brand), foreground === "#ffffff" ? luminance("#000000") : 1),
      );
      expect(["#000000", "#ffffff"]).toContain(foreground);
    },
  );

  it("uses white when the input is not a supported hex color", () => {
    expect(getAccessibleForeground("orange")).toBe("#ffffff");
  });
});
