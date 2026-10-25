"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import {
  getEntitledThemeId,
  getThemeById,
  isPaidPlan,
  isThemePaid,
  type ThemeDefinition,
  type ThemeMode,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeDefinition;
  setTheme: (themeId: string) => void;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function applyThemeToDocument(themeId: string) {
  if (typeof document === "undefined") {
    return;
  }
  if (document.body.getAttribute("data-theme") !== themeId) {
    document.body.setAttribute("data-theme", themeId);
  }
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: string | null | undefined;
  children: ReactNode;
}) {
  const [themeId, setThemeId] = useState(() => getThemeById(initialTheme).id);
  const { entitlements } = useSubscription();
  const hasPaidThemeAccess = entitlements
    ? isPaidPlan(entitlements.effectivePlan)
    : isThemePaid(getThemeById(initialTheme).id);
  const visibleThemeId = getEntitledThemeId(themeId, hasPaidThemeAccess);

  useEffect(() => {
    applyThemeToDocument(visibleThemeId);
  }, [visibleThemeId]);

  const theme = getThemeById(visibleThemeId);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode: theme.mode,
        setTheme: (nextId) => {
          const resolved = getThemeById(nextId).id;
          const allowedTheme = getEntitledThemeId(resolved, hasPaidThemeAccess);
          setThemeId(allowedTheme);
          applyThemeToDocument(allowedTheme);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
