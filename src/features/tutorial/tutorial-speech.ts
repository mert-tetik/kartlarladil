"use client";

import type { LocaleCode } from "@/types/domain";

export const TUTORIAL_SPEECH_ASSET_VERSION = "20261105-foxy-mascot-v1";

export const TUTORIAL_SPEECH_KEYS = [
  "welcome",
  "welcome-add-cards",
  "card-collection-prompt",
  "landing-cards-action",
  "landing-cards-message",
  "landing-start-learning-action",
] as const;

export type TutorialSpeechKey = (typeof TUTORIAL_SPEECH_KEYS)[number];

const SPEECH_KEY_BY_TRANSLATION_KEY: Record<string, TutorialSpeechKey> = {
  "tutorial.cardCollectionPrompt": "card-collection-prompt",
  "tutorial.landingCardsAction": "landing-cards-action",
  "tutorial.landingCardsMessage": "landing-cards-message",
  "tutorial.landingStartLearningAction": "landing-start-learning-action",
};

type PendingTutorialSpeech = {
  key: TutorialSpeechKey;
  locale: LocaleCode;
};

const audioCache = new Map<string, HTMLAudioElement>();
let activeAudio: HTMLAudioElement | null = null;
let pendingSpeech: PendingTutorialSpeech | null = null;
let activationListenersWindow: Window | null = null;

export function getTutorialSpeechAssetUrl(key: TutorialSpeechKey, locale: LocaleCode) {
  return `/tutorial-speech/${locale}/${key}.mp3?v=${TUTORIAL_SPEECH_ASSET_VERSION}`;
}

export function getTutorialSpeechKeyForTranslationKey(translationKey: string) {
  return SPEECH_KEY_BY_TRANSLATION_KEY[translationKey] ?? null;
}

export function preloadTutorialSpeech(locale: LocaleCode) {
  if (typeof window === "undefined") return;

  for (const key of TUTORIAL_SPEECH_KEYS) {
    const url = getTutorialSpeechAssetUrl(key, locale);
    if (audioCache.has(url)) continue;

    const audio = new Audio(url);
    audio.preload = "auto";
    audioCache.set(url, audio);
    audio.load();
  }
}

function installActivationListeners() {
  if (typeof window === "undefined" || activationListenersWindow === window) return;
  activationListenersWindow = window;

  const retryPendingSpeech = () => {
    const pending = pendingSpeech;
    if (!pending) return;

    pendingSpeech = null;
    playTutorialSpeech(pending.key, pending.locale);
  };

  window.addEventListener("pointerup", retryPendingSpeech, { capture: true, passive: true });
  window.addEventListener("touchend", retryPendingSpeech, { capture: true, passive: true });
  window.addEventListener("keydown", retryPendingSpeech, { capture: true });
}

function isAutoplayRejection(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && (error as { name?: unknown }).name === "NotAllowedError";
}

export function playTutorialSpeech(key: TutorialSpeechKey, locale: LocaleCode) {
  if (typeof window === "undefined") return false;

  const url = getTutorialSpeechAssetUrl(key, locale);
  stopTutorialSpeech();

  const audio = audioCache.get(url) ?? new Audio(url);
  audioCache.set(url, audio);
  audio.preload = "auto";
  audio.currentTime = 0;
  activeAudio = audio;
  audio.onended = () => {
    if (activeAudio === audio) activeAudio = null;
  };
  audio.onerror = () => {
    if (activeAudio === audio) activeAudio = null;
  };

  try {
    const playback = audio.play();
    void playback?.catch((error: unknown) => {
      if (activeAudio !== audio) return;
      activeAudio = null;
      if (isAutoplayRejection(error)) {
        pendingSpeech = { key, locale };
        installActivationListeners();
      }
    });
    return true;
  } catch (error) {
    activeAudio = null;
    if (isAutoplayRejection(error)) {
      pendingSpeech = { key, locale };
      installActivationListeners();
    }
    return false;
  }
}

export function stopTutorialSpeech() {
  pendingSpeech = null;

  if (!activeAudio) return;

  try {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch {
    // A media element failure must not block tutorial navigation.
  }
  activeAudio.onended = null;
  activeAudio.onerror = null;
  activeAudio = null;
}
