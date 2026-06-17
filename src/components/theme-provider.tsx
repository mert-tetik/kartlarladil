"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME_ID, THEMES, getThemeById, type ThemeDefinition } from "@/lib/themes";

type ThemeMode = "light" | "dark";

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
  document.body.setAttribute("data-theme", themeId);
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: string | null | undefined;
  children: ReactNode;
}) {
  const [themeId, setThemeId] = useState(initialTheme ?? DEFAULT_THEME_ID);

  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const theme = getThemeById(themeId);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode: theme.mode,
        setTheme: (nextId) => {
          const resolved = THEMES.find((t) => t.id === nextId)?.id ?? DEFAULT_THEME_ID;
          setThemeId(resolved);
          applyThemeToDocument(resolved);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
