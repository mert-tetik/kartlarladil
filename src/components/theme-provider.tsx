"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getThemeById, type ThemeDefinition, type ThemeMode } from "@/lib/themes";

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
          const resolved = getThemeById(nextId).id;
          setThemeId(resolved);
          applyThemeToDocument(resolved);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
