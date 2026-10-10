import type { LanguageCode } from "@/types/domain";

export type SpeechVoiceGender = "female" | "male";
export type SpeechVoiceAge = "young" | "adult" | "elder";

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

type BrowserSpeechRequest = {
  text: string;
  lang: string;
  rate: number;
};

let browserSpeechActivationWindow: Window | null = null;
let pendingBrowserSpeechRequest: BrowserSpeechRequest | null = null;

function installBrowserSpeechActivationListeners() {
  if (typeof window === "undefined" || browserSpeechActivationWindow === window) return;
  browserSpeechActivationWindow = window;

  const resumeSpeech = () => {
    if (!("speechSynthesis" in window)) return;
    // Mobile Safari/Chromium can leave the speech queue paused after a page
    // transition. Resuming from a real user interaction is the most portable
    // way to unlock that queue without making the first automatic utterance
    // depend on a browser-specific autoplay heuristic.
    window.speechSynthesis.resume?.();

    const pendingRequest = pendingBrowserSpeechRequest;
    if (pendingRequest) {
      pendingBrowserSpeechRequest = null;
      speakWithBrowserSpeech(pendingRequest);
    }
  };

  window.addEventListener("pointerup", resumeSpeech, { capture: true, passive: true });
  window.addEventListener("touchend", resumeSpeech, { capture: true, passive: true });
  window.addEventListener("keydown", resumeSpeech, { capture: true, passive: true });
}

function speakWithBrowserSpeech(request: BrowserSpeechRequest) {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    return false;
  }

  const speechSynthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(request.text);

  utterance.lang = request.lang;
  utterance.rate = request.rate;
  utterance.onerror = (event) => {
    // Mobile browsers may reject automatic speech until a user gesture has
    // unlocked the synthesis queue. Keep only that latest utterance and retry
    // from the capture-phase gesture listener; interrupted/cancelled speech
    // must never resurrect an older question's pronunciation.
    if (event.error === "not-allowed") {
      pendingBrowserSpeechRequest = request;
    }
  };

  try {
    speechSynthesis.cancel();
    speechSynthesis.resume?.();
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    pendingBrowserSpeechRequest = request;
    return false;
  }
}

export function getSpeechLanguage(language: LanguageCode) {
  return SPEECH_LANG_BY_LANGUAGE[language];
}

export function speakText(
  text: string,
  language: LanguageCode,
  options?: {
    rate?: number;
    voiceGender?: SpeechVoiceGender;
    voiceAge?: SpeechVoiceAge;
  },
) {
  if (typeof window === "undefined" || !text.trim()) {
    return false;
  }

  const lang = getSpeechLanguage(language);
  const nativeSpeech = window.FoxiesDeckNativeSpeech;
  if (nativeSpeech) {
    try {
      // Android TTS voice metadata is not reliable across engines. A voice
      // can match the requested gender/age but still be unavailable or fail
      // silently when selected. The native path therefore always uses the
      // engine's known-good voice for the requested language. The browser
      // fallback follows the same language-only rule below.
      if (nativeSpeech.speak(text, lang, options?.rate ?? 0.95) !== false) {
        return true;
      }
    } catch {
      // A stale bridge can survive a WebView navigation for one turn. Let the
      // browser implementation take over instead of silently dropping speech.
    }
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  installBrowserSpeechActivationListeners();
  pendingBrowserSpeechRequest = null;
  // `voiceschanged` is only a notification that a preferred voice list has
  // changed; it is not a prerequisite for speaking. On mobile the event can
  // arrive late or not at all, while the browser can still synthesize using
  // the requested utterance.lang and its default language voice. Voice
  // gender/age metadata is intentionally ignored: mobile engines expose it
  // inconsistently and selecting a profile can make an otherwise valid voice
  // request fail silently.
  return speakWithBrowserSpeech({
    text,
    lang,
    rate: Math.max(0.5, Math.min(options?.rate ?? 0.95, 2)),
  });
}

export function speakCardTerm(
  term: string,
  language: LanguageCode,
  voiceGender?: SpeechVoiceGender,
  voiceAge?: SpeechVoiceAge,
) {
  return speakText(term, language, { rate: 0.9, voiceGender, voiceAge });
}
