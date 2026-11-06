"use client";

import type { LocaleCode } from "@/types/domain";

export const TUTORIAL_SPEECH_ASSET_VERSION = "20261105-foxy-mascot-v2";

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
const speechQueue: PendingTutorialSpeech[] = [];
let activeAudio: HTMLAudioElement | null = null;
let activeSpeech: PendingTutorialSpeech | null = null;
let pendingSpeech: PendingTutorialSpeech | null = null;
let activationListenersWindow: Window | null = null;
let activationRetryHandler: (() => void) | null = null;
let recoveryListenersWindow: Window | null = null;
let recoveryHandler: (() => void) | null = null;

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
    removeActivationListeners();
    playTutorialSpeech(pending.key, pending.locale);
  };
  activationRetryHandler = retryPendingSpeech;

  window.addEventListener("pointerup", retryPendingSpeech, { capture: true, passive: true });
  window.addEventListener("touchend", retryPendingSpeech, { capture: true, passive: true });
  window.addEventListener("keydown", retryPendingSpeech, { capture: true });
}

function removeActivationListeners() {
  if (typeof window === "undefined" || activationListenersWindow !== window) return;

  if (activationRetryHandler) {
    window.removeEventListener("pointerup", activationRetryHandler, { capture: true });
    window.removeEventListener("touchend", activationRetryHandler, { capture: true });
    window.removeEventListener("keydown", activationRetryHandler, { capture: true });
  }
  activationRetryHandler = null;
  activationListenersWindow = null;
}

function isAutoplayRejection(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && (error as { name?: unknown }).name === "NotAllowedError";
}

function areSameSpeech(first: PendingTutorialSpeech | null, second: PendingTutorialSpeech) {
  return first?.key === second.key && first.locale === second.locale;
}

function removeRecoveryListeners() {
  if (typeof window === "undefined" || recoveryListenersWindow !== window) return;

  if (recoveryHandler) {
    document.removeEventListener("visibilitychange", recoveryHandler);
    window.removeEventListener("pageshow", recoveryHandler);
  }
  recoveryHandler = null;
  recoveryListenersWindow = null;
}

function installRecoveryListeners() {
  if (typeof window === "undefined" || recoveryListenersWindow === window) return;

  recoveryListenersWindow = window;
  const recover = () => {
    if (document.visibilityState === "visible") recoverActiveSpeech();
  };

  recoveryHandler = recover;
  document.addEventListener("visibilitychange", recover);
  window.addEventListener("pageshow", recover);
}

function clearAudioHandlers(audio: HTMLAudioElement) {
  audio.onended = null;
  audio.onerror = null;
  audio.onpause = null;
}

function finishActiveSpeech(audio: HTMLAudioElement) {
  if (activeAudio !== audio) return;

  clearAudioHandlers(audio);
  activeAudio = null;
  activeSpeech = null;
  const nextSpeech = speechQueue.shift();
  if (nextSpeech) {
    startTutorialSpeech(nextSpeech);
    return;
  }

  removeRecoveryListeners();
}

function handleSpeechPlaybackError(audio: HTMLAudioElement, error: unknown) {
  if (activeAudio !== audio) return;

  const currentSpeech = activeSpeech;
  const nextSpeech = speechQueue.shift();
  clearAudioHandlers(audio);
  activeAudio = null;
  activeSpeech = null;

  if (isAutoplayRejection(error)) {
    // If the user has already moved on, retry the newest queued sentence on
    // the next activation instead of replaying stale tutorial copy.
    pendingSpeech = nextSpeech ?? currentSpeech;
    installActivationListeners();
    return;
  }

  if (nextSpeech) {
    startTutorialSpeech(nextSpeech);
    return;
  }

  removeRecoveryListeners();
}

function recoverActiveSpeech() {
  const audio = activeAudio;
  if (!audio || audio.ended || !audio.paused) return;

  try {
    const playback = audio.play();
    void playback?.catch((error: unknown) => handleSpeechPlaybackError(audio, error));
  } catch (error) {
    handleSpeechPlaybackError(audio, error);
  }
}

function startTutorialSpeech(speech: PendingTutorialSpeech) {
  const url = getTutorialSpeechAssetUrl(speech.key, speech.locale);
  const audio = audioCache.get(url) ?? new Audio(url);
  audioCache.set(url, audio);
  audio.preload = "auto";
  audio.currentTime = 0;
  activeAudio = audio;
  activeSpeech = speech;
  installRecoveryListeners();
  audio.onended = () => finishActiveSpeech(audio);
  audio.onerror = () => finishActiveSpeech(audio);
  audio.onpause = () => {
    if (activeAudio !== audio || audio.ended || document.visibilityState !== "visible") return;
    window.setTimeout(() => {
      if (activeAudio === audio && audio.paused && !audio.ended) recoverActiveSpeech();
    }, 0);
  };

  try {
    const playback = audio.play();
    void playback?.catch((error: unknown) => handleSpeechPlaybackError(audio, error));
    return true;
  } catch (error) {
    handleSpeechPlaybackError(audio, error);
    return false;
  }
}

export function playTutorialSpeech(key: TutorialSpeechKey, locale: LocaleCode) {
  if (typeof window === "undefined") return false;

  const speech = { key, locale } satisfies PendingTutorialSpeech;
  if (activeAudio?.ended) finishActiveSpeech(activeAudio);

  if (activeAudio) {
    if (areSameSpeech(activeSpeech, speech) || speechQueue.some((queuedSpeech) => areSameSpeech(queuedSpeech, speech))) return true;
    speechQueue.push(speech);
    return true;
  }

  if (pendingSpeech) {
    pendingSpeech = speech;
    installActivationListeners();
    return true;
  }

  return startTutorialSpeech(speech);
}

export function stopTutorialSpeech() {
  pendingSpeech = null;
  speechQueue.length = 0;
  removeActivationListeners();

  const audio = activeAudio;
  activeAudio = null;
  activeSpeech = null;
  removeRecoveryListeners();
  if (!audio) return;

  clearAudioHandlers(audio);
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // A media element failure must not block tutorial navigation.
  }
}
