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

interface BrowserAudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const SOUND_EFFECTS_ENABLED = true;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as BrowserAudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  audioContext ??= new AudioContextConstructor();

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

interface ToneOptions {
  frequency: number;
  endFrequency?: number;
  startTime: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

function playTone(context: AudioContext, options: ToneOptions) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const endTime = options.startTime + options.duration;

  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, options.startTime);

  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, endTime);
  }

  gainNode.gain.setValueAtTime(0.0001, options.startTime);
  gainNode.gain.exponentialRampToValueAtTime(options.gain, options.startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(options.startTime);
  oscillator.stop(endTime + 0.02);
}

interface NoiseOptions {
  startTime: number;
  duration: number;
  gain: number;
  filterFrequency: number;
}

function playNoise(context: AudioContext, options: NoiseOptions) {
  const bufferSize = context.sampleRate * options.duration;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();
  const endTime = options.startTime + options.duration;

  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(options.filterFrequency, options.startTime);

  gainNode.gain.setValueAtTime(0.0001, options.startTime);
  gainNode.gain.exponentialRampToValueAtTime(options.gain, options.startTime + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);

  noise.start(options.startTime);
  noise.stop(endTime + 0.02);
}

function playChord(context: AudioContext, frequencies: number[], startTime: number, duration: number, gain: number) {
  for (const frequency of frequencies) {
    playTone(context, { frequency, startTime, duration, gain });
  }
}

// Pleasant C-major pentatonic frequencies for sparkle/chime sounds.
const SCALE = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
};

function correct(context: AudioContext, now: number) {
  // Bright, satisfying major-third chime.
  playTone(context, { frequency: SCALE.C5, startTime: now, duration: 0.14, gain: 0.07 });
  playTone(context, { frequency: SCALE.E5, startTime: now + 0.04, duration: 0.2, gain: 0.06 });
  playTone(context, { frequency: SCALE.G5, startTime: now + 0.08, duration: 0.24, gain: 0.04 });
}

function incorrect(context: AudioContext, now: number) {
  // Soft, low "nope" thud — not harsh.
  playTone(context, { frequency: 160, startTime: now, duration: 0.18, gain: 0.12, type: "sine" });
  playNoise(context, { startTime: now, duration: 0.1, gain: 0.08, filterFrequency: 180 });
}

function points(context: AudioContext, now: number) {
  // Tiny high coin tick.
  playTone(context, { frequency: SCALE.G5, startTime: now, duration: 0.07, gain: 0.05 });
  playTone(context, { frequency: SCALE.C6, startTime: now + 0.02, duration: 0.09, gain: 0.035 });
}

function learned(context: AudioContext, now: number) {
  // Magical ascending arpeggio + shimmer.
  const notes = [SCALE.C5, SCALE.E5, SCALE.G5, SCALE.C6];
  notes.forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + index * 0.07,
      duration: 0.18,
      gain: 0.055 - index * 0.005,
    });
  });

  playTone(context, { frequency: SCALE.E6, startTime: now + 0.32, duration: 0.3, gain: 0.03 });
  playTone(context, { frequency: SCALE.G6, startTime: now + 0.36, duration: 0.3, gain: 0.025 });
}

function rankUp(context: AudioContext, now: number) {
  // Triumphant fanfare.
  const arpeggio = [SCALE.G4, SCALE.C5, SCALE.E5, SCALE.G5];
  arpeggio.forEach((frequency, index) => {
    playTone(context, { frequency, startTime: now + index * 0.09, duration: 0.22, gain: 0.07 });
  });

  playChord(context, [SCALE.C5, SCALE.E5, SCALE.G5, SCALE.C6], now + 0.42, 0.5, 0.05);
}

function quizComplete(context: AudioContext, now: number) {
  // Warm success chord with sparkle.
  playChord(context, [SCALE.C4, SCALE.E4, SCALE.G4, SCALE.C5], now, 0.45, 0.055);

  const sparkle = [SCALE.E5, SCALE.G5, SCALE.C6, SCALE.E6];
  sparkle.forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + 0.18 + index * 0.04,
      duration: 0.16,
      gain: 0.025,
    });
  });
}

function confetti(context: AudioContext, now: number) {
  // Rapid cluster of random pentatonic sparkles.
  const notes = [SCALE.C5, SCALE.D5, SCALE.E5, SCALE.G5, SCALE.A5, SCALE.C6];
  const count = 8;

  for (let i = 0; i < count; i++) {
    const frequency = notes[Math.floor(Math.random() * notes.length)];
    playTone(context, {
      frequency,
      startTime: now + i * 0.035,
      duration: 0.08,
      gain: 0.025,
    });
  }
}

function chestTap(context: AudioContext, now: number) {
  // Short wood/block thud.
  playNoise(context, { startTime: now, duration: 0.07, gain: 0.12, filterFrequency: 350 });
  playTone(context, { frequency: 120, startTime: now, duration: 0.08, gain: 0.1, type: "sine" });
}

function chestOpen(context: AudioContext, now: number) {
  // Magical rising sweep + bright chord.
  playTone(context, {
    frequency: SCALE.C4,
    endFrequency: SCALE.C6,
    startTime: now,
    duration: 0.4,
    gain: 0.04,
    type: "triangle",
  });

  playChord(context, [SCALE.C5, SCALE.E5, SCALE.G5], now + 0.35, 0.45, 0.05);
  playTone(context, { frequency: SCALE.C6, startTime: now + 0.45, duration: 0.35, gain: 0.04 });
}

const EFFECT_SYNTHESIZERS: Record<SoundEffectName, (context: AudioContext, now: number) => void> = {
  correct,
  incorrect,
  "rank-up": rankUp,
  points,
  learned,
  confetti,
  "quiz-complete": quizComplete,
  "chest-tap": chestTap,
  "chest-open": chestOpen,
};

export function playSoundEffect(effect: SoundEffectName) {
  if (!SOUND_EFFECTS_ENABLED) {
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

    const synthesizer = EFFECT_SYNTHESIZERS[effect];
    synthesizer(context, context.currentTime);
  } catch {
    // Audio feedback should never block quiz or navigation interactions.
  }
}

// Kept for tests and any future introspection.
export const SOUND_EFFECT_SYNTHESIZERS = EFFECT_SYNTHESIZERS;
