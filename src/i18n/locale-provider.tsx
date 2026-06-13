"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_MAX_AGE_SECONDS,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
} from "@/i18n/config";
import { translate, type TranslationKey, type TranslationValues } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";

interface LocaleContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: LocaleCode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    if (typeof window === "undefined") {
      return initialLocale ?? DEFAULT_LOCALE;
    }

    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? initialLocale);
  });

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);

        if (typeof document !== "undefined") {
          document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${LOCALE_MAX_AGE_SECONDS}; samesite=lax`;
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
        }

        router.refresh();
      },
      t(key, values) {
        return translate(locale, key, values);
      },
    }),
    [locale, router],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider.");
  }

  return context;
}

export function useT() {
  return useLocale().t;
}
