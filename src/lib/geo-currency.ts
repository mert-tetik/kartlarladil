"use client";

import { matchSupportedLocale } from "@/data/languages";
import type { LanguageCode } from "@/types/domain";

const GEO_CACHE_KEY = "foxiesdeck:geoCurrency";
const RATE_CACHE_KEY = "foxiesdeck:exchangeRate";
const GEO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type GeoCurrencyInfo = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  languageCode: LanguageCode | null;
};

type GeoCacheEntry = {
  info: GeoCurrencyInfo;
  fetchedAt: number;
};

type RateCacheEntry = {
  rate: number;
  fetchedAt: number;
};

export async function fetchGeoCurrencyInfo(): Promise<GeoCurrencyInfo | null> {
  if (typeof window === "undefined") return null;

  const cached = readCache<GeoCacheEntry>(GEO_CACHE_KEY);
  if (cached && Date.now() - cached.fetchedAt < GEO_CACHE_TTL_MS) {
    return cached.info;
  }

  try {
    const response = await fetch("https://ipapi.co/json/", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      country_code?: string;
      country_name?: string;
      currency?: string;
      languages?: string;
    };

    const countryCode = (data.country_code ?? "").toUpperCase();
    const countryName = data.country_name ?? "";
    const currencyCode = (data.currency ?? "").toUpperCase();
    const languages = data.languages ?? "";

    if (!countryCode || !currencyCode) return null;

    const languageCode = detectLanguageFromCountryLanguages(languages);

    const info: GeoCurrencyInfo = {
      countryCode,
      countryName,
      currencyCode,
      languageCode,
    };

    writeCache(GEO_CACHE_KEY, { info, fetchedAt: Date.now() });
    return info;
  } catch {
    return null;
  }
}

function detectLanguageFromCountryLanguages(languages: string): LanguageCode | null {
  const codes = languages
    .split(",")
    .map((code) => code.trim().split("-")[0])
    .filter(Boolean);

  for (const code of codes) {
    const matched = matchSupportedLocale(code);
    if (matched) return matched as LanguageCode;
  }

  return null;
}

export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  if (typeof window === "undefined") return null;

  const cacheKey = `${RATE_CACHE_KEY}:${from}:${to}`;
  const cached = readCache<RateCacheEntry>(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];

    if (typeof rate !== "number") return null;

    writeCache(cacheKey, { rate, fetchedAt: Date.now() });
    return rate;
  } catch {
    return null;
  }
}

export async function convertUsdToCurrency(
  usdAmount: number,
  currencyCode: string,
): Promise<number | null> {
  const rate = await fetchExchangeRate("USD", currencyCode);
  if (rate === null) return null;
  return Math.round(usdAmount * rate);
}

export function formatCurrency(amount: number, currencyCode: string, localeCode: string): string {
  return new Intl.NumberFormat(localeCode, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

function readCache<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}
