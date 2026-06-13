import type { LanguageCode } from "@/types/domain";

const SPEECH_LANG_BY_LANGUAGE: Record<LanguageCode, string> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
  ru: "ru-RU",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
  ar: "ar-SA",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-CN": "zh-CN",
};

export function getSpeechLanguage(language: LanguageCode) {
  return SPEECH_LANG_BY_LANGUAGE[language];
}

export function speakText(text: string, language: LanguageCode, options?: { rate?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  const lang = getSpeechLanguage(language);
  const utterance = new SpeechSynthesisUtterance(text);
  const matchingVoice = findMatchingVoice(lang);

  utterance.lang = lang;
  utterance.rate = options?.rate ?? 0.95;

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return true;
}

export function speakCardTerm(term: string, language: LanguageCode) {
  return speakText(term, language, { rate: 0.9 });
}

function findMatchingVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const normalizedLang = lang.toLocaleLowerCase();
  const baseLang = normalizedLang.split("-")[0];

  return (
    voices.find((voice) => voice.lang.toLocaleLowerCase() === normalizedLang) ??
    voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith(`${baseLang}-`)) ??
    null
  );
}
