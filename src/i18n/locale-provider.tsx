"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

    if (storedLocale) {
      const normalizedStoredLocale = normalizeLocale(storedLocale);

      persistLocalePreference(normalizedStoredLocale);

      if (normalizedStoredLocale !== locale) {
        const syncTimer = window.setTimeout(() => setLocaleState(normalizedStoredLocale), 0);
        return () => window.clearTimeout(syncTimer);
      }

      return;
    }

    persistLocalePreference(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        persistLocalePreference(nextLocale);
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

function persistLocalePreference(locale: LocaleCode) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_MAX_AGE_SECONDS}; samesite=lax`;
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
