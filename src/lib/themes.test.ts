import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, THEMES, getThemeById, getThemeCssText, getThemeCssVariables } from "@/lib/themes";

describe("theme palettes", () => {
  it("keeps the default dark brand and surfaces", () => {
    const dark = getThemeById(DEFAULT_THEME_ID).palette;

    expect(dark).toMatchObject({
      brand: "#f76808",
      background: "#090909",
      backgroundCard: "#121212",
      foreground: "#fafafa",
      actionLearn: "#10b981",
      actionReview: "#0ea5e9",
    });
    expect(getThemeById("default").id).toBe(DEFAULT_THEME_ID);
    expect(getThemeById("violet").id).toBe("violet-dark");
  });

  it("exposes only dark theme variants", () => {
    expect(THEMES).toHaveLength(10);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(10);
    expect(THEMES.every((theme) => theme.mode === "dark" && theme.id.endsWith("-dark"))).toBe(true);

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
    const cssText = getThemeCssText();

    expect(variables["--brand"]).toBe("#8b5cf6");
    expect(variables["--action-learn"]).toBeTruthy();
    expect(variables["--tier-a1-text"]).toBeTruthy();
    expect(cssText).toContain('[data-theme="violet-dark"]');
    expect(cssText).not.toContain('[data-theme="violet"]');
  });
});
