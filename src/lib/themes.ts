import type { CSSProperties } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_SWATCH_KEYS = ["actionLearn", "actionReview", "actionDraw", "actionCustom"] as const;
export type ThemeSwatchKey = (typeof THEME_SWATCH_KEYS)[number];

export type ThemeToken =
  | "brand" | "brandHover" | "brandForeground" | "background" | "backgroundCard" | "backgroundMuted"
  | "backgroundInverse" | "foreground" | "foregroundSecondary" | "foregroundMuted" | "foregroundInverse"
  | "foregroundInverseSecondary" | "foregroundInverseMuted" | "border" | "ringBrand" | "actionLearn"
  | "actionLearnHover" | "actionReview" | "actionReviewHover" | "actionDraw" | "actionCustom"
  | "actionLearned" | "actionInactive" | "accentPrimary" | "accentSecondary" | "accentTertiary"
  | "accentQuaternary" | "tierA1" | "tierA1Text" | "tierA2" | "tierA2Text" | "tierB1" | "tierB1Text"
  | "tierB2" | "tierB2Text" | "tierC1" | "tierC1Text" | "rewardStart" | "rewardEnd" | "rankStart"
  | "rankEnd" | "missionStart" | "missionEnd" | "premiumStart" | "premiumEnd" | "themeLightIndicator"
  | "themeDarkIndicator";

export type ThemePalette = Readonly<Record<ThemeToken, string>>;

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: ThemeMode;
  brand: string;
  brandForeground: string;
  palette: ThemePalette;
}

type AccentSet = {
  actionLearn: string; actionReview: string; actionDraw: string; actionCustom: string;
  accentPrimary: string; accentSecondary: string; accentTertiary: string; accentQuaternary: string;
  tierA1: string; tierA2: string; tierB1: string; tierB2: string; tierC1: string;
  rewardStart: string; rewardEnd: string; rankStart: string; rankEnd: string;
  missionStart: string; missionEnd: string; premiumStart: string; premiumEnd: string;
};

type ThemeFamily = { id: string; name: string; brand: string; brandForeground: string; accents: AccentSet };

const DEFAULT_LIGHT_SURFACES = {
  background: "#f8fafc", backgroundCard: "#ffffff", backgroundMuted: "#f1f5f9", backgroundInverse: "#0f172a",
  foreground: "#0f172a", foregroundSecondary: "#475569", foregroundMuted: "#94a3b8", foregroundInverse: "#ffffff",
  foregroundInverseSecondary: "#cbd5e1", foregroundInverseMuted: "#94a3b8", border: "#e2e8f0",
};

const DEFAULT_DARK_SURFACES = {
  background: "#090909", backgroundCard: "#121212", backgroundMuted: "#1a1a1a", backgroundInverse: "#f5f5f5",
  foreground: "#fafafa", foregroundSecondary: "#a3a3a3", foregroundMuted: "#525252", foregroundInverse: "#090909",
  foregroundInverseSecondary: "#404040", foregroundInverseMuted: "#525252", border: "#262626",
};

const DEFAULT_ACCENTS: AccentSet = {
  actionLearn: "#10b981", actionReview: "#0ea5e9", actionDraw: "#facc15", actionCustom: "#f43f5e",
  accentPrimary: "#f76808", accentSecondary: "#0ea5e9", accentTertiary: "#10b981", accentQuaternary: "#8b5cf6",
  tierA1: "#10b981", tierA2: "#0ea5e9", tierB1: "#8b5cf6", tierB2: "#f59e0b", tierC1: "#f43f5e",
  rewardStart: "#f59e0b", rewardEnd: "#f97316", rankStart: "#fbbf24", rankEnd: "#f97316",
  missionStart: "#f59e0b", missionEnd: "#f97316", premiumStart: "#fbbf24", premiumEnd: "#f97316",
};

const THEME_FAMILIES: ThemeFamily[] = [
  { id: "default", name: "Foxies Orange", brand: "#f76808", brandForeground: "#ffffff", accents: DEFAULT_ACCENTS },
  { id: "ocean", name: "Ocean Blue", brand: "#0ea5e9", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#14b8a6", actionReview: "#6366f1", actionDraw: "#fbbf24", actionCustom: "#f472b6", accentPrimary: "#0ea5e9", accentSecondary: "#14b8a6", accentTertiary: "#6366f1", accentQuaternary: "#f472b6", rewardStart: "#38bdf8", rewardEnd: "#2563eb", rankStart: "#67e8f9", rankEnd: "#3b82f6", missionStart: "#22d3ee", missionEnd: "#2563eb", premiumStart: "#a5f3fc", premiumEnd: "#3b82f6" } },
  { id: "emerald", name: "Emerald Green", brand: "#10b981", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#059669", actionReview: "#0ea5e9", actionDraw: "#facc15", actionCustom: "#8b5cf6", accentPrimary: "#10b981", accentSecondary: "#0ea5e9", accentTertiary: "#84cc16", accentQuaternary: "#8b5cf6", rewardStart: "#34d399", rewardEnd: "#059669", rankStart: "#a3e635", rankEnd: "#10b981", missionStart: "#2dd4bf", missionEnd: "#059669", premiumStart: "#bef264", premiumEnd: "#059669" } },
  { id: "violet", name: "Violet", brand: "#8b5cf6", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#a855f7", actionReview: "#06b6d4", actionDraw: "#fbbf24", actionCustom: "#ec4899", accentPrimary: "#8b5cf6", accentSecondary: "#06b6d4", accentTertiary: "#ec4899", accentQuaternary: "#f59e0b", rewardStart: "#c084fc", rewardEnd: "#7c3aed", rankStart: "#f0abfc", rankEnd: "#8b5cf6", missionStart: "#e879f9", missionEnd: "#7c3aed", premiumStart: "#f5d0fe", premiumEnd: "#8b5cf6" } },
  { id: "rose", name: "Rose", brand: "#f43f5e", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#e11d48", actionReview: "#8b5cf6", actionDraw: "#f59e0b", actionCustom: "#06b6d4", accentPrimary: "#f43f5e", accentSecondary: "#8b5cf6", accentTertiary: "#fb923c", accentQuaternary: "#06b6d4", rewardStart: "#fb7185", rewardEnd: "#e11d48", rankStart: "#fda4af", rankEnd: "#e11d48", missionStart: "#fb7185", missionEnd: "#be123c", premiumStart: "#fecdd3", premiumEnd: "#e11d48" } },
  { id: "amber", name: "Amber", brand: "#f59e0b", brandForeground: "#0f172a", accents: { ...DEFAULT_ACCENTS, actionLearn: "#eab308", actionReview: "#0ea5e9", actionDraw: "#f97316", actionCustom: "#d946ef", accentPrimary: "#f59e0b", accentSecondary: "#f97316", accentTertiary: "#eab308", accentQuaternary: "#d946ef", rewardStart: "#fbbf24", rewardEnd: "#ea580c", rankStart: "#fde68a", rankEnd: "#f59e0b", missionStart: "#facc15", missionEnd: "#ea580c", premiumStart: "#fef3c7", premiumEnd: "#f59e0b" } },
  { id: "teal", name: "Teal", brand: "#14b8a6", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#0d9488", actionReview: "#0284c7", actionDraw: "#facc15", actionCustom: "#f43f5e", accentPrimary: "#14b8a6", accentSecondary: "#0284c7", accentTertiary: "#84cc16", accentQuaternary: "#f43f5e", rewardStart: "#2dd4bf", rewardEnd: "#0f766e", rankStart: "#99f6e4", rankEnd: "#14b8a6", missionStart: "#5eead4", missionEnd: "#0f766e", premiumStart: "#ccfbf1", premiumEnd: "#14b8a6" } },
  { id: "indigo", name: "Indigo", brand: "#6366f1", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#4f46e5", actionReview: "#0891b2", actionDraw: "#f59e0b", actionCustom: "#ec4899", accentPrimary: "#6366f1", accentSecondary: "#0891b2", accentTertiary: "#f43f5e", accentQuaternary: "#f59e0b", rewardStart: "#818cf8", rewardEnd: "#4338ca", rankStart: "#c4b5fd", rankEnd: "#6366f1", missionStart: "#818cf8", missionEnd: "#4338ca", premiumStart: "#e0e7ff", premiumEnd: "#6366f1" } },
  { id: "crimson", name: "Crimson", brand: "#dc2626", brandForeground: "#ffffff", accents: { ...DEFAULT_ACCENTS, actionLearn: "#be123c", actionReview: "#7c3aed", actionDraw: "#f59e0b", actionCustom: "#0891b2", accentPrimary: "#dc2626", accentSecondary: "#7c3aed", accentTertiary: "#f97316", accentQuaternary: "#0891b2", rewardStart: "#fb7185", rewardEnd: "#b91c1c", rankStart: "#fda4af", rankEnd: "#dc2626", missionStart: "#f87171", missionEnd: "#b91c1c", premiumStart: "#fee2e2", premiumEnd: "#dc2626" } },
  { id: "lime", name: "Lime", brand: "#84cc16", brandForeground: "#0f172a", accents: { ...DEFAULT_ACCENTS, actionLearn: "#65a30d", actionReview: "#0284c7", actionDraw: "#f59e0b", actionCustom: "#a855f7", accentPrimary: "#84cc16", accentSecondary: "#0284c7", accentTertiary: "#f59e0b", accentQuaternary: "#a855f7", rewardStart: "#bef264", rewardEnd: "#65a30d", rankStart: "#d9f99d", rankEnd: "#84cc16", missionStart: "#a3e635", missionEnd: "#4d7c0f", premiumStart: "#ecfccb", premiumEnd: "#84cc16" } },
];

function buildPalette(family: ThemeFamily, mode: ThemeMode): ThemePalette {
  const surfaces = mode === "dark" ? DEFAULT_DARK_SURFACES : DEFAULT_LIGHT_SURFACES;
  const { accents } = family;
  const textFor = (light: string, dark: string) => (mode === "dark" ? dark : light);

  return {
    ...surfaces,
    brand: family.brand,
    brandHover: `color-mix(in oklab, ${family.brand} 85%, black)`,
    brandForeground: family.brandForeground,
    ringBrand: family.brand,
    actionLearn: accents.actionLearn,
    actionLearnHover: `color-mix(in oklab, ${accents.actionLearn} 85%, black)`,
    actionReview: accents.actionReview,
    actionReviewHover: `color-mix(in oklab, ${accents.actionReview} 85%, black)`,
    actionDraw: accents.actionDraw,
    actionCustom: accents.actionCustom,
    actionLearned: accents.actionReview,
    actionInactive: mode === "dark" ? "#404040" : "#e2e8f0",
    accentPrimary: accents.accentPrimary,
    accentSecondary: accents.accentSecondary,
    accentTertiary: accents.accentTertiary,
    accentQuaternary: accents.accentQuaternary,
    tierA1: accents.tierA1,
    tierA1Text: textFor("#059669", "#34d399"),
    tierA2: accents.tierA2,
    tierA2Text: textFor("#0284c7", "#38bdf8"),
    tierB1: accents.tierB1,
    tierB1Text: textFor("#7c3aed", "#a78bfa"),
    tierB2: accents.tierB2,
    tierB2Text: textFor("#d97706", "#fbbf24"),
    tierC1: accents.tierC1,
    tierC1Text: textFor("#e11d48", "#fb7185"),
    rewardStart: accents.rewardStart,
    rewardEnd: accents.rewardEnd,
    rankStart: accents.rankStart,
    rankEnd: accents.rankEnd,
    missionStart: accents.missionStart,
    missionEnd: accents.missionEnd,
    premiumStart: accents.premiumStart,
    premiumEnd: accents.premiumEnd,
    themeLightIndicator: "#ffffff",
    themeDarkIndicator: "#090909",
  };
}

export const THEMES: ThemeDefinition[] = THEME_FAMILIES.flatMap((family) =>
  (["light", "dark"] as const).map((mode) => ({
    id: mode === "light" ? family.id : `${family.id}-dark`,
    name: mode === "light" ? family.name : `${family.name} Dark`,
    mode,
    brand: family.brand,
    brandForeground: family.brandForeground,
    palette: buildPalette(family, mode),
  })),
);

export const DEFAULT_THEME_ID = "default-dark";
export const FREE_THEME_IDS = new Set([DEFAULT_THEME_ID, `${DEFAULT_THEME_ID}-dark`]);

export function getThemeById(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}

function toCssVariableName(token: ThemeToken): `--${string}` {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}` as `--${string}`;
}

export function getThemeCssVariables(themeId: string | null | undefined): CSSProperties {
  const { palette } = getThemeById(themeId);
  return Object.fromEntries(Object.entries(palette).map(([token, value]) => [toCssVariableName(token as ThemeToken), value])) as CSSProperties;
}

export function getThemeCssText(): string {
  return THEMES.map(({ id, palette }) => {
    const declarations = Object.entries(palette)
      .map(([token, value]) => `${toCssVariableName(token as ThemeToken)}:${value}`)
      .join(";");
    return `[data-theme="${id}"]{${declarations}}`;
  }).join("");
}

export function isPaidPlan(plan: "free" | "basic" | "pro"): boolean {
  return plan !== "free";
}

export function isThemePaid(themeId: string): boolean {
  return !FREE_THEME_IDS.has(themeId);
}
