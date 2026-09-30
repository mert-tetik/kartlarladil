import type { LanguageCode } from "@/types/domain";

export type SpeechVoiceGender = "female" | "male";
export type SpeechVoiceAge = "young" | "adult" | "elder";

const FEMALE_VOICE_HINTS = [
  "female",
  "woman",
  "zira",
  "samantha",
  "susan",
  "karen",
  "hazel",
  "sara",
  "ava",
  "jenny",
  "aria",
  "libby",
  "salli",
  "joanna",
  "emma",
  "olivia",
  "victoria",
  "monica",
  "helena",
  "anna",
  "yuna",
  "kyoko",
  "mei-jia",
] as const;

const MALE_VOICE_HINTS = [
  "male",
  "man",
  "david",
  "mark",
  "guy",
  "daniel",
  "alex",
  "george",
  "james",
  "thomas",
  "arthur",
  "frank",
  "leo",
  "enrique",
  "jorge",
] as const;

const YOUNG_VOICE_HINTS = ["young", "teen", "child", "kid", "junior", "youth"] as const;
const ELDER_VOICE_HINTS = ["elder", "elderly", "senior", "grandma", "grandmother", "grandpa", "grandfather", "old"] as const;
const BROWSER_VOICE_LOAD_TIMEOUT_MS = 1_200;

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

export function speakText(
  text: string,
  language: LanguageCode,
  options?: {
    rate?: number;
    voiceGender?: SpeechVoiceGender;
    voiceAge?: SpeechVoiceAge;
  },
) {
  if (typeof window === "undefined") {
    return false;
  }

  const lang = getSpeechLanguage(language);
  const nativeSpeech = window.FoxiesDeckNativeSpeech;
  if (nativeSpeech) {
    if (options?.voiceGender || options?.voiceAge) {
      const speakWithProfile = nativeSpeech.speakWithProfile;
      if (typeof speakWithProfile === "function") {
        return speakWithProfile(
          text,
          lang,
          options.rate ?? 0.95,
          options.voiceGender,
          options.voiceAge,
        );
      }
    }

    return nativeSpeech.speak(text, lang, options?.rate ?? 0.95);
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  const speechSynthesis = window.speechSynthesis;
  const speakWithLoadedVoices = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const matchingVoice = findMatchingVoice(lang, options?.voiceGender, options?.voiceAge);

    utterance.lang = lang;
    utterance.rate = options?.rate ?? 0.95;

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  // Mobile browsers often expose an empty voice list on the first render.
  // Waiting for voiceschanged prevents the first automatic quiz pronunciation
  // from falling back to the browser's default (usually male) voice.
  if (speechSynthesis.getVoices().length === 0) {
    let spoken = false;
    const speakWhenReady = () => {
      if (spoken || speechSynthesis.getVoices().length === 0) return;
      spoken = true;
      speechSynthesis.removeEventListener("voiceschanged", speakWhenReady);
      speakWithLoadedVoices();
    };

    speechSynthesis.addEventListener("voiceschanged", speakWhenReady);
    window.setTimeout(() => {
      if (spoken) return;
      spoken = true;
      speechSynthesis.removeEventListener("voiceschanged", speakWhenReady);
      speakWithLoadedVoices();
    }, BROWSER_VOICE_LOAD_TIMEOUT_MS);
  } else {
    speakWithLoadedVoices();
  }

  return true;
}

export function speakCardTerm(
  term: string,
  language: LanguageCode,
  voiceGender?: SpeechVoiceGender,
  voiceAge?: SpeechVoiceAge,
) {
  return speakText(term, language, { rate: 0.9, voiceGender, voiceAge });
}

function findMatchingVoice(
  lang: string,
  voiceGender?: SpeechVoiceGender,
  voiceAge?: SpeechVoiceAge,
) {
  const voices = window.speechSynthesis.getVoices();
  const normalizedLang = lang.toLocaleLowerCase();
  const baseLang = normalizedLang.split("-")[0];
  const languageVoices = voices.filter((voice) => {
    const normalizedVoiceLanguage = voice.lang.toLocaleLowerCase();
    return (
      normalizedVoiceLanguage === normalizedLang ||
      normalizedVoiceLanguage.startsWith(`${baseLang}-`)
    );
  });

  const genderVoices = voiceGender
    ? languageVoices.filter((voice) => {
      const voiceLabel = `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase();
        const genderHints = voiceGender === "female" ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
        return genderHints.some((hint) => hasVoiceHint(voiceLabel, hint));
      })
    : languageVoices;

  if (voiceAge) {
    const ageHints = voiceAge === "young"
      ? YOUNG_VOICE_HINTS
      : voiceAge === "elder"
        ? ELDER_VOICE_HINTS
        : null;

    if (ageHints) {
      const ageVoice = genderVoices.find((voice) => {
        const voiceLabel = `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase();
        return ageHints.some((hint) => hasVoiceHint(voiceLabel, hint));
      });

      if (ageVoice) return ageVoice;
    }
  }

  if (voiceGender) {
    const genderHints = voiceGender === "female" ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
    const genderVoice = languageVoices.find((voice) => {
      const voiceLabel = `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase();
      return genderHints.some((hint) => hasVoiceHint(voiceLabel, hint));
    });

    if (genderVoice) return genderVoice;
  }

  return (
    languageVoices.find((voice) => voice.lang.toLocaleLowerCase() === normalizedLang) ??
    languageVoices[0] ??
    null
  );
}

function hasVoiceHint(voiceLabel: string, hint: string) {
  const escapedHint = hint.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^a-z])${escapedHint}(?:$|[^a-z])`, "u").test(voiceLabel);
}
