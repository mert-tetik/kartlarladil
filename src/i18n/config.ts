import { LANGUAGE_BY_CODE, LOCALE_CODES, getLocaleDirection, isLocaleCode } from "@/data/languages";
import type { LocaleCode } from "@/types/domain";

export const DEFAULT_LOCALE: LocaleCode = "tr";
export const LOCALE_COOKIE_NAME = "kartlarla-dil:locale";
export const LOCALE_STORAGE_KEY = "kartlarla-dil:locale";
export const LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export { LOCALE_CODES, getLocaleDirection, isLocaleCode };

export function normalizeLocale(value: string | null | undefined): LocaleCode {
  return value && isLocaleCode(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleLabel(locale: LocaleCode) {
  return LANGUAGE_BY_CODE[locale];
}
