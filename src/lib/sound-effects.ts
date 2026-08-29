export type SoundEffectName =
  | "correct"
  | "incorrect"
  | "rank-up-opening"
  | "rank-up-reveal"
  | "points"
  | "learned"
  | "confetti"
  | "quiz-complete"
  | "quiz-start"
  | "quiz-select"
  | "card-swipe-right"
  | "card-swipe-left"
  | "chest-tap"
  | "chest-open"
  | "streak-fire"
  | "clock-tick-low"
  | "clock-tick-high"
  | "level-fail"
  | "card-ready"
  | "mission-claim";

interface BrowserAudioWindow extends Window {
  Audio?: typeof Audio;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const SOUND_EFFECTS_ENABLED = true;
const SOUND_EFFECT_AUDIO_FILES: Partial<Record<SoundEffectName, string>> = {
  incorrect: "/sounds/false.mp3",
  learned: "/sounds/learned-elevenlabs-v1.mp3",
  confetti: "/sounds/confetti-elevenlabs-v1.mp3",
  "quiz-complete": "/sounds/quiz-complete-elevenlabs-v1.mp3",
  "quiz-start": "/sounds/quiz-start-elevenlabs-v1.mp3",
  "quiz-select": "/sounds/quiz-select-elevenlabs-v1.mp3",
  "card-swipe-right": "/sounds/card-swipe-right-elevenlabs-v1.mp3",
  "card-swipe-left": "/sounds/card-swipe-left-elevenlabs-v1.mp3",
  "rank-up-opening": "/sounds/rank-up-opening-poyo-v3.mp3",
  "rank-up-reveal": "/sounds/rank-up-reveal-elevenlabs-v4.mp3",
  "chest-open": "/sounds/chest.mp3",
  "streak-fire": "/sounds/streak.mp3",
  "level-fail": "/sounds/level-fail-elevenlabs-v1.mp3",
  "card-ready": "/sounds/card-ready-elevenlabs-v1.mp3",
  "mission-claim": "/sounds/stream.mp3",
};

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

function playSynthesizedEffect(effect: SoundEffectName) {
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

function playAudioFile(effect: SoundEffectName) {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }

  const src = SOUND_EFFECT_AUDIO_FILES[effect];
  if (!src) {
    return false;
  }

  const audioWindow = window as BrowserAudioWindow;
  const AudioConstructor = audioWindow.Audio;

  if (typeof AudioConstructor !== "function") {
    return false;
  }

  try {
    const audio = new AudioConstructor(src);
    audio.preload = "auto";

    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      void playResult.catch(() => {
        // Autoplay and network failures still get the Web Audio fallback.
        playSynthesizedEffect(effect);
      });
    }

    return true;
  } catch {
    return false;
  }
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
  playTone(context, { frequency: SCALE.C5, startTime: now, duration: 0.14, gain: 0.12 });
  playTone(context, { frequency: SCALE.E5, startTime: now + 0.04, duration: 0.2, gain: 0.1 });
  playTone(context, { frequency: SCALE.G5, startTime: now + 0.08, duration: 0.24, gain: 0.08 });
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

function rankUpOpening(context: AudioContext, now: number) {
  // Fallback for the accelerating pre-reveal drum roll.
  const hits = [
    { offset: 0, frequency: 118, gain: 0.105 },
    { offset: 0.2, frequency: 126, gain: 0.095 },
    { offset: 0.37, frequency: 134, gain: 0.1 },
    { offset: 0.51, frequency: 142, gain: 0.11 },
    { offset: 0.62, frequency: 150, gain: 0.115 },
    { offset: 0.71, frequency: 158, gain: 0.12 },
    { offset: 0.79, frequency: 166, gain: 0.125 },
    { offset: 0.86, frequency: 174, gain: 0.13 },
    { offset: 0.92, frequency: 182, gain: 0.135 },
    { offset: 0.98, frequency: 190, gain: 0.14 },
    { offset: 1.03, frequency: 198, gain: 0.145 },
    { offset: 1.08, frequency: 206, gain: 0.15 },
    { offset: 1.13, frequency: 214, gain: 0.155 },
    { offset: 1.18, frequency: 222, gain: 0.16 },
    { offset: 1.23, frequency: 230, gain: 0.165 },
    { offset: 1.28, frequency: 238, gain: 0.17 },
    { offset: 1.33, frequency: 246, gain: 0.175 },
    { offset: 1.38, frequency: 254, gain: 0.18 },
    { offset: 1.43, frequency: 262, gain: 0.185 },
    { offset: 1.48, frequency: 270, gain: 0.19 },
    { offset: 1.53, frequency: 278, gain: 0.195 },
    { offset: 1.58, frequency: 286, gain: 0.2 },
    { offset: 1.63, frequency: 294, gain: 0.205 },
    { offset: 1.68, frequency: 302, gain: 0.21 },
  ];

  for (const hit of hits) {
    const startTime = now + hit.offset;
    playNoise(context, { startTime, duration: 0.045, gain: hit.gain, filterFrequency: 900 });
    playTone(context, { frequency: hit.frequency, startTime, duration: 0.065, gain: hit.gain * 0.55, type: "sine" });
  }
}

function rankUpReveal(context: AudioContext, now: number) {
  // Bright, satisfying reveal fallback.
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

function quizStart(context: AudioContext, now: number) {
  // Short ascending cue that leads into the first question.
  [SCALE.C5, SCALE.E5, SCALE.G5].forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + index * 0.09,
      duration: 0.16,
      gain: 0.055,
      type: "triangle",
    });
  });
}

function quizSelect(context: AudioContext, now: number) {
  // Tactile selection pop followed by a quick upward launch sweep.
  playTone(context, { frequency: 180, startTime: now, duration: 0.1, gain: 0.1, type: "triangle" });
  playTone(context, {
    frequency: SCALE.C4,
    endFrequency: SCALE.G5,
    startTime: now + 0.04,
    duration: 0.34,
    gain: 0.05,
    type: "sine",
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

function streakFire(context: AudioContext, now: number) {
  // Punchy, fast fire burst: low sawtooth thump + filtered noise + crackles.
  playTone(context, {
    frequency: 120,
    startTime: now,
    duration: 0.12,
    gain: 0.14,
    type: "sawtooth",
  });
  playNoise(context, { startTime: now, duration: 0.18, gain: 0.16, filterFrequency: 450 });

  for (let i = 0; i < 6; i++) {
    playNoise(context, {
      startTime: now + 0.02 + i * 0.025,
      duration: 0.02,
      gain: 0.07,
      filterFrequency: 2800,
    });
  }
}

function clockTickLow(context: AudioContext, now: number) {
  // Soft, short tick for the last 10 seconds.
  playTone(context, { frequency: 800, startTime: now, duration: 0.04, gain: 0.025 });
}

function clockTickHigh(context: AudioContext, now: number) {
  // Sharper, louder tick for the final 3 seconds.
  playTone(context, { frequency: 1200, startTime: now, duration: 0.05, gain: 0.06 });
}

function levelFail(context: AudioContext, now: number) {
  // Disappointing descending two-tone buzz.
  playTone(context, { frequency: 220, startTime: now, duration: 0.18, gain: 0.1, type: "sawtooth" });
  playTone(context, { frequency: 165, startTime: now + 0.14, duration: 0.28, gain: 0.1, type: "sawtooth" });
  playNoise(context, { startTime: now, duration: 0.35, gain: 0.06, filterFrequency: 220 });
}

function cardReady(context: AudioContext, now: number) {
  // Bright chime: "çiling".
  playTone(context, { frequency: SCALE.C6, startTime: now, duration: 0.14, gain: 0.08 });
  playTone(context, { frequency: SCALE.E6, startTime: now + 0.04, duration: 0.18, gain: 0.06 });
  playTone(context, { frequency: SCALE.G6, startTime: now + 0.08, duration: 0.22, gain: 0.045 });
}

function missionClaim(context: AudioContext, now: number) {
  // Thick, tactile reward thunk with a short golden tail.
  playTone(context, {
    frequency: 170,
    endFrequency: 108,
    startTime: now,
    duration: 0.16,
    gain: 0.14,
    type: "triangle",
  });
  playNoise(context, { startTime: now, duration: 0.05, gain: 0.035, filterFrequency: 720 });
  playTone(context, { frequency: SCALE.C4, startTime: now + 0.02, duration: 0.2, gain: 0.08, type: "sine" });
  playTone(context, { frequency: SCALE.G4, startTime: now + 0.05, duration: 0.18, gain: 0.05, type: "triangle" });
  playTone(context, { frequency: SCALE.C5, startTime: now + 0.1, duration: 0.18, gain: 0.028, type: "triangle" });
}

const EFFECT_SYNTHESIZERS: Record<SoundEffectName, (context: AudioContext, now: number) => void> = {
  correct,
  incorrect,
  "rank-up-opening": rankUpOpening,
  "rank-up-reveal": rankUpReveal,
  points,
  learned,
  confetti,
  "quiz-complete": quizComplete,
  "quiz-start": quizStart,
  "quiz-select": quizSelect,
  "chest-tap": chestTap,
  "chest-open": chestOpen,
  "streak-fire": streakFire,
  "clock-tick-low": clockTickLow,
  "clock-tick-high": clockTickHigh,
  "level-fail": levelFail,
  "card-ready": cardReady,
  "mission-claim": missionClaim,
};

export function playSoundEffect(effect: SoundEffectName) {
  if (!SOUND_EFFECTS_ENABLED) {
    return;
  }

  if (playAudioFile(effect)) {
    return;
  }

  playSynthesizedEffect(effect);
}

// Kept for tests and any future introspection.
export const SOUND_EFFECT_SYNTHESIZERS = EFFECT_SYNTHESIZERS;
