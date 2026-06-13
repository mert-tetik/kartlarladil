import "server-only";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeLocale, getLocaleDirection, matchSupportedLocale } from "@/i18n/config";

export async function getServerLocale() {
  const cookieStore = await cookies();
  const cookieLocale = matchSupportedLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  if (cookieLocale) {
    return cookieLocale;
  }

  const headerStore = await headers();
  return getPreferredLocaleFromAcceptLanguage(headerStore.get("accept-language"));
}

export async function getServerTextDirection() {
  return getLocaleDirection(await getServerLocale());
}

function getPreferredLocaleFromAcceptLanguage(header: string | null) {
  if (!header) {
    return normalizeLocale(null);
  }

  const candidates = header
    .split(",")
    .map((entry) => {
      const [languageRange, ...params] = entry.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1;

      return {
        languageRange,
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((candidate) => candidate.languageRange && candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const candidate of candidates) {
    const locale = matchSupportedLocale(candidate.languageRange);

    if (locale) {
      return locale;
    }
  }

  return normalizeLocale(null);
}
