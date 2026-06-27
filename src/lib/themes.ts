export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: ThemeMode;
  brand: string;
  brandForeground: string;
}

function brandForeground(brand: string): string {
  const lightBrands = new Set(["#f59e0b", "#84cc16"]);
  return lightBrands.has(brand.toLowerCase()) ? "#0f172a" : "#ffffff";
}

const brandColors = [
  { id: "default", name: "Foxies Orange", brand: "#f76808" },
  { id: "ocean", name: "Ocean Blue", brand: "#0ea5e9" },
  { id: "emerald", name: "Emerald Green", brand: "#10b981" },
  { id: "violet", name: "Violet", brand: "#8b5cf6" },
  { id: "rose", name: "Rose", brand: "#f43f5e" },
  { id: "amber", name: "Amber", brand: "#f59e0b" },
  { id: "teal", name: "Teal", brand: "#14b8a6" },
  { id: "indigo", name: "Indigo", brand: "#6366f1" },
  { id: "crimson", name: "Crimson", brand: "#dc2626" },
  { id: "lime", name: "Lime", brand: "#84cc16" },
] as const;

export const THEMES: ThemeDefinition[] = brandColors.flatMap((item) => {
  const base = {
    brand: item.brand,
    brandForeground: brandForeground(item.brand),
  };

  return [
    {
      id: item.id,
      name: item.name,
      mode: "light" as const,
      ...base,
    },
    {
      id: `${item.id}-dark`,
      name: `${item.name} Dark`,
      mode: "dark" as const,
      ...base,
    },
  ];
});

export const DEFAULT_THEME_ID = "default-dark";

export const FREE_THEME_IDS = new Set([DEFAULT_THEME_ID, `${DEFAULT_THEME_ID}-dark`]);

export function getThemeById(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}

export function isPaidPlan(plan: "free" | "basic" | "pro"): boolean {
  return plan !== "free";
}

export function isThemePaid(themeId: string): boolean {
  return !FREE_THEME_IDS.has(themeId);
}
