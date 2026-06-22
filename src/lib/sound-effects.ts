export type SoundEffectName =
  | "correct"
  | "incorrect"
  | "rank-up"
  | "points"
  | "learned"
  | "confetti"
  | "quiz-complete"
  | "chest-tap"
  | "chest-open";

type AssetBackedSoundEffectName = Exclude<SoundEffectName, "correct">;

type SoundEffectAsset = {
  src: string;
  volume: number;
  playbackRate?: number;
};

interface BrowserAudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export const SOUND_EFFECT_ASSETS: Readonly<Record<AssetBackedSoundEffectName, SoundEffectAsset>> = {
  incorrect: { src: "/sounds/incorrect.mp3", volume: 0.48 },
  "rank-up": { src: "/sounds/rank-up.mp3", volume: 0.58 },
  points: { src: "/sounds/points.mp3", volume: 0.4 },
  learned: { src: "/sounds/learned.mp3", volume: 0.45 },
  confetti: { src: "/sounds/confetti.mp3", volume: 0.36 },
  "quiz-complete": { src: "/sounds/quiz-complete.mp3", volume: 0.48 },
  "chest-tap": { src: "/sounds/chest-tap.mp3", volume: 0.52 },
  "chest-open": { src: "/sounds/chest-open.mp3", volume: 0.58 },
} as const;

const SOUND_EFFECTS_ENABLED = false;

let audioContext: AudioContext | null = null;

export function playSoundEffect(effect: SoundEffectName) {
  if (!SOUND_EFFECTS_ENABLED) {
    return;
  }

  if (effect !== "correct") {
    playAudioAsset(SOUND_EFFECT_ASSETS[effect]);
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    playCorrectEffect(context);
  } catch {
    // Audio feedback should never block quiz or navigation interactions.
  }
}

function playAudioAsset({ src, volume, playbackRate = 1 }: SoundEffectAsset) {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return;
  }

  try {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    void audio.play();
  } catch {
    // Ignore audio playback errors.
  }
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as BrowserAudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  audioContext ??= new AudioContextConstructor();

  return audioContext;
}

function playCorrectEffect(context: AudioContext) {
  const now = context.currentTime;

  playTone(context, { frequency: 520, startTime: now, duration: 0.11, gain: 0.07, type: "sine" });
  playTone(context, { frequency: 780, startTime: now + 0.08, duration: 0.16, gain: 0.08, type: "triangle" });
}

function playTone(
  context: AudioContext,
  {
    frequency,
    endFrequency,
    startTime,
    duration,
    gain,
    type,
  }: {
    frequency: number;
    endFrequency?: number;
    startTime: number;
    duration: number;
    gain: number;
    type: OscillatorType;
  },
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
  }

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.018);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}
