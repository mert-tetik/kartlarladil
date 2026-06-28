import { LANGUAGES } from "@/data/languages";
import type { LanguageCode } from "@/types/domain";

export const LANDING_CARD_LANGUAGE_KEY = "foxiesdeck:landing-card-language";

export function readLandingCardLanguage(): LanguageCode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(LANDING_CARD_LANGUAGE_KEY);
  if (stored && LANGUAGES.some((language) => language.code === stored)) {
    return stored as LanguageCode;
  }

  return null;
}
