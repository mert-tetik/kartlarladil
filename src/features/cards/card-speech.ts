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

export function speakCardTerm(term: string, language: LanguageCode) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  const lang = SPEECH_LANG_BY_LANGUAGE[language];
  const utterance = new SpeechSynthesisUtterance(term);
  const matchingVoice = findMatchingVoice(lang);

  utterance.lang = lang;
  utterance.rate = 0.9;

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return true;
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
