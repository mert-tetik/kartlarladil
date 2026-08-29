import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, THEMES, getThemeById, getThemeCssVariables } from "@/lib/themes";

describe("theme palettes", () => {
  it("keeps the existing default brand and surfaces", () => {
    const light = getThemeById("default").palette;
    const dark = getThemeById(DEFAULT_THEME_ID).palette;

    expect(light).toMatchObject({
      brand: "#f76808",
      background: "#f8fafc",
      backgroundCard: "#ffffff",
      foreground: "#0f172a",
      actionLearn: "#10b981",
      actionReview: "#0ea5e9",
    });
    expect(dark).toMatchObject({
      brand: "#f76808",
      background: "#090909",
      backgroundCard: "#121212",
      foreground: "#fafafa",
      actionLearn: "#10b981",
      actionReview: "#0ea5e9",
    });
  });

  it("provides a complete palette for every saved theme id", () => {
    expect(THEMES).toHaveLength(20);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(20);

    for (const theme of THEMES) {
      expect(theme.palette.brand).toBe(theme.brand);
      expect(theme.palette.actionLearn).toMatch(/^#/);
      expect(theme.palette.actionReview).toMatch(/^#/);
      expect(theme.palette.tierA1).toMatch(/^#/);
      expect(theme.palette.rewardStart).toMatch(/^#/);
      expect(theme.palette.rewardEnd).toMatch(/^#/);
    }
  });

  it("serializes palette tokens for server and client theme application", () => {
    const variables = getThemeCssVariables("violet-dark") as Record<string, string>;

    expect(variables["--brand"]).toBe("#8b5cf6");
    expect(variables["--action-learn"]).toBeTruthy();
    expect(variables["--tier-a1-text"]).toBeTruthy();
  });
});
