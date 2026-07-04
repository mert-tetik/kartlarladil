import { LANGUAGES } from "@/data/languages";
import type { LanguageCode } from "@/types/domain";

export const LANDING_CARD_LANGUAGE_KEY = "foxiesdeck:landing-card-language";
const LANDING_CARD_LANGUAGE_EVENT = "foxiesdeck:landing-card-language-changed";

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

export function writeLandingCardLanguage(language: LanguageCode, options?: { notify?: boolean }) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, language);

  if (options?.notify !== false) {
    window.dispatchEvent(new Event(LANDING_CARD_LANGUAGE_EVENT));
  }
}

export function subscribeLandingCardLanguage(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === LANDING_CARD_LANGUAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LANDING_CARD_LANGUAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LANDING_CARD_LANGUAGE_EVENT, onStoreChange);
  };
}
