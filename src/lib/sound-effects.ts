export type SoundEffectName =
  | "correct"
  | "incorrect"
  | "rank-up-opening"
  | "rank-up-reveal"
  | "points"
  | "learned"
  | "confetti"
  | "quiz-complete"
  | "mission-passed"
  | "quiz-medals-complete"
  | "quiz-medal-reveal"
  | "quiz-completion-progress-pop"
  | "quiz-select"
  | "word-select"
  | "word-repetition-complete"
  | "streak-count-reveal"
  | "rank-highlight"
  | "bonus-select"
  | "bonus-reward-loot"
  | "bonus-invalid-operation"
  | "pricing-perk-select"
  | "card-swipe-right"
  | "card-swipe-left"
  | "chest-tap"
  | "chest-open"
  | "chest-crack"
  | "clock-tick-low"
  | "clock-tick-high"
  | "level-fail"
  | "mission-claim"
  | "gem-loot"
  | "gem-spend"
  | "result-medal-collect"
  | "result-action-press"
  | "result-card-reveal";

interface BrowserAudioWindow extends Window {
  Audio?: typeof Audio;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

type PitchShiftableAudio = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

const SOUND_EFFECTS_ENABLED = true;
const SOUND_EFFECT_AUDIO_FILES: Partial<Record<SoundEffectName, string>> = {
  incorrect: "/sounds/false.mp3",
  learned: "/sounds/learned-elevenlabs-v1.mp3",
  confetti: "/sounds/confetti-elevenlabs-v1.mp3",
  "quiz-complete": "/sounds/quiz-complete-elevenlabs-v1.mp3",
  "mission-passed": "/sounds/mission-passed.mp3",
  "quiz-completion-progress-pop": "/sounds/quiz-completion-progress-pop.mp3",
  "quiz-medal-reveal": "/sounds/medal-reveal-universfield-bonus-03.mp3?v=20261008-1",
  "quiz-select": "/sounds/quiz-select-elevenlabs-v1.mp3",
  "word-repetition-complete": "/sounds/word-repetition-complete.mp3?v=20261008-3",
  // Source: user-provided achievement badge pop sound from Downloads.
  "streak-count-reveal": "/sounds/streak-count-reveal.mp3?v=20261002-2",
  "card-swipe-right": "/sounds/card-swipe-right-elevenlabs-v1.mp3",
  "card-swipe-left": "/sounds/card-swipe-left-elevenlabs-v1.mp3",
  "rank-up-opening": "/sounds/rank-up-opening-poyo-v3.mp3",
  "rank-up-reveal": "/sounds/rank-up-reveal.mp3",
  "chest-open": "/sounds/chest.mp3",
  "chest-crack": "/sounds/crack-audio.mp3",
  "bonus-reward-loot": "/sounds/bonus-reward-loot-collect.mp3?v=20261008-1",
  "level-fail": "/sounds/level-fail-elevenlabs-v1.mp3",
  "mission-claim": "/sounds/stream.mp3",
  "gem-loot": "/sounds/gem-collect-opengameart-v1.mp3",
  "gem-spend": "/sounds/gem-spend-freesound-v1.mp3",
  // Source: user-provided Downloads/koiroylers-get-coin-351945.mp3.
  "result-medal-collect": "/sounds/medal-collect-koiroylers-v1.mp3",
};
const SOUND_EFFECT_VOLUMES: Partial<Record<SoundEffectName, number>> = {
  "mission-passed": 0.6,
};

let audioContext: AudioContext | null = null;
const preloadedSoundEffects = new Set<string>();
const preloadedSoundEffectAudios = new Map<string, HTMLAudioElement>();

export function preloadSoundEffects(effects: readonly SoundEffectName[]) {
  if (typeof window === "undefined") return;

  const audioWindow = window as BrowserAudioWindow;
  const AudioConstructor = audioWindow.Audio;
  if (typeof AudioConstructor !== "function") return;

  for (const effect of effects) {
    const source = SOUND_EFFECT_AUDIO_FILES[effect];
    if (!source || preloadedSoundEffects.has(source)) continue;

    try {
      const audio = new AudioConstructor(source);
      audio.preload = "auto";
      audio.load();
      preloadedSoundEffectAudios.set(source, audio);
      preloadedSoundEffects.add(source);
    } catch {
      // Preloading is opportunistic and must never block the quiz flow.
    }
  }
}

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

function playSynthesizedEffect(effect: SoundEffectName, playbackRate = 1) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    const synthesizer = EFFECT_SYNTHESIZERS[effect];
    synthesizer(context, context.currentTime, playbackRate);
  } catch {
    // Audio feedback should never block quiz or navigation interactions.
  }
}

function playAudioFile(effect: SoundEffectName, playbackRate = 1) {
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
    const audio = preloadedSoundEffectAudios.get(src) ?? new AudioConstructor(src);
    audio.preload = "auto";
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some media elements reject seeking before their metadata is ready.
    }
    audio.volume = SOUND_EFFECT_VOLUMES[effect] ?? 1;
    const rate = Math.max(0.5, Math.min(playbackRate, 2.5));
    audio.playbackRate = rate;
    const pitchShiftableAudio = audio as PitchShiftableAudio;
    pitchShiftableAudio.preservesPitch = false;
    pitchShiftableAudio.mozPreservesPitch = false;
    pitchShiftableAudio.webkitPreservesPitch = false;

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

function correct(context: AudioContext, now: number, playbackRate = 1) {
  // Bright, satisfying major-third chime.
  const rate = Math.max(0.5, Math.min(playbackRate, 2.5));
  playTone(context, {
    frequency: SCALE.C5 * rate,
    startTime: now,
    duration: 0.14 / rate,
    gain: 0.12,
  });
  playTone(context, {
    frequency: SCALE.E5 * rate,
    startTime: now + 0.04 / rate,
    duration: 0.2 / rate,
    gain: 0.1,
  });
  playTone(context, {
    frequency: SCALE.G5 * rate,
    startTime: now + 0.08 / rate,
    duration: 0.24 / rate,
    gain: 0.08,
  });
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

function missionPassed(context: AudioContext, now: number) {
  // Fallback celebration when the packaged mission-passed file cannot play.
  quizComplete(context, now);
}

function quizMedalsComplete(context: AudioContext, now: number) {
  // Short, bright confirmation jingle after the earned medals finish revealing.
  const notes = [SCALE.G5, SCALE.C6, SCALE.E6, SCALE.G6];
  notes.forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + index * 0.065,
      duration: 0.2,
      gain: 0.045 - index * 0.004,
      type: "triangle",
    });
  });
  playChord(context, [SCALE.C6, SCALE.E6, SCALE.G6], now + 0.18, 0.34, 0.025);
}

function quizMedalReveal(context: AudioContext, now: number, playbackRate = 1) {
  // A louder metallic "cling" with a bright ring and a quick decay.
  const rate = Math.max(0.5, Math.min(playbackRate, 2.5));
  playTone(context, {
    frequency: 720 * rate,
    endFrequency: 1160 * rate,
    startTime: now,
    duration: 0.075 / rate,
    gain: 0.1,
    type: "sine",
  });
  playTone(context, {
    frequency: 1360 * rate,
    endFrequency: 1980 * rate,
    startTime: now + 0.01 / rate,
    duration: 0.19 / rate,
    gain: 0.12,
    type: "sine",
  });
  playTone(context, {
    frequency: 2720 * rate,
    startTime: now + 0.016 / rate,
    duration: 0.26 / rate,
    gain: 0.05,
    type: "triangle",
  });
}

function quizCompletionProgressPop(context: AudioContext, now: number) {
  // Fallback for browsers that cannot play the packaged achievement pop file.
  playTone(context, {
    frequency: 220,
    endFrequency: 460,
    startTime: now,
    duration: 0.1,
    gain: 0.08,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.G5,
    endFrequency: SCALE.C6,
    startTime: now + 0.04,
    duration: 0.16,
    gain: 0.045,
    type: "sine",
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

function wordSelect(context: AudioContext, now: number) {
  // A short, self-contained tap with a tiny bright lift for word selection.
  playTone(context, {
    frequency: 240,
    endFrequency: 170,
    startTime: now,
    duration: 0.055,
    gain: 0.065,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.C5,
    endFrequency: SCALE.E5,
    startTime: now + 0.008,
    duration: 0.085,
    gain: 0.035,
    type: "sine",
  });
}

function streakCountReveal(context: AudioContext, now: number) {
  // A compact, satisfying pop followed by a bright two-note reveal chime.
  playTone(context, {
    frequency: 210,
    endFrequency: 420,
    startTime: now,
    duration: 0.11,
    gain: 0.085,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.G5,
    endFrequency: SCALE.C6,
    startTime: now + 0.045,
    duration: 0.17,
    gain: 0.045,
    type: "sine",
  });
  playTone(context, {
    frequency: SCALE.C6,
    endFrequency: SCALE.E6,
    startTime: now + 0.09,
    duration: 0.15,
    gain: 0.028,
    type: "triangle",
  });
}

function rankHighlight(context: AudioContext, now: number) {
  // A short, gentle ascending chime for moving between rank cards.
  playTone(context, {
    frequency: 330,
    endFrequency: 495,
    startTime: now,
    duration: 0.1,
    gain: 0.045,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.G5,
    endFrequency: SCALE.C6,
    startTime: now + 0.04,
    duration: 0.13,
    gain: 0.032,
    type: "sine",
  });
}

function bonusSelect(context: AudioContext, now: number) {
  // Compact, warm click with a tiny sparkle that stays pleasant when tapped repeatedly.
  playTone(context, {
    frequency: 230,
    endFrequency: 155,
    startTime: now,
    duration: 0.065,
    gain: 0.075,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.C6,
    endFrequency: SCALE.E6,
    startTime: now + 0.012,
    duration: 0.11,
    gain: 0.04,
    type: "sine",
  });
  playTone(context, {
    frequency: SCALE.G5,
    startTime: now + 0.035,
    duration: 0.08,
    gain: 0.022,
    type: "triangle",
  });
}

function bonusInvalidOperation(context: AudioContext, now: number) {
  // A short, soft descending double-beep reserved for rejected bonus matches.
  playTone(context, {
    frequency: 285,
    endFrequency: 205,
    startTime: now,
    duration: 0.075,
    gain: 0.065,
    type: "triangle",
  });
  playTone(context, {
    frequency: 190,
    endFrequency: 125,
    startTime: now + 0.055,
    duration: 0.105,
    gain: 0.055,
    type: "triangle",
  });
}

function pricingPerkSelect(context: AudioContext, now: number) {
  // Very short, soft sparkle for moving between subscription benefits.
  playTone(context, {
    frequency: SCALE.E5,
    endFrequency: SCALE.G5,
    startTime: now,
    duration: 0.07,
    gain: 0.035,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.C6,
    startTime: now + 0.025,
    duration: 0.075,
    gain: 0.025,
    type: "sine",
  });
}

function cardSwipeRight(context: AudioContext, now: number) {
  // Light rightward swipe cue used when advancing to the next card.
  playTone(context, {
    frequency: 260,
    endFrequency: 620,
    startTime: now,
    duration: 0.16,
    gain: 0.045,
    type: "sine",
  });
}

function cardSwipeLeft(context: AudioContext, now: number) {
  // Matching descending cue used when moving back to the previous card.
  playTone(context, {
    frequency: 620,
    endFrequency: 260,
    startTime: now,
    duration: 0.16,
    gain: 0.045,
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

function chestCrack(context: AudioContext, now: number) {
  // Fallback for the provided crack sample if file playback is unavailable.
  playNoise(context, { startTime: now, duration: 0.12, gain: 0.11, filterFrequency: 260 });
  playTone(context, {
    frequency: 115,
    endFrequency: 58,
    startTime: now,
    duration: 0.13,
    gain: 0.08,
    type: "sawtooth",
  });
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

function gemLoot(context: AudioContext, now: number) {
  playTone(context, { frequency: SCALE.C6, endFrequency: 2093, startTime: now, duration: 0.16, gain: 0.08, type: "triangle" });
  playTone(context, { frequency: SCALE.E6, endFrequency: 3136, startTime: now + 0.07, duration: 0.2, gain: 0.06, type: "sine" });
}

function gemSpend(context: AudioContext, now: number) {
  playTone(context, { frequency: 880, endFrequency: 1320, startTime: now, duration: 0.08, gain: 0.07, type: "sine" });
  playTone(context, { frequency: 1320, endFrequency: 1760, startTime: now + 0.06, duration: 0.16, gain: 0.06, type: "triangle" });
}

function resultMedalCollect(context: AudioContext, now: number) {
  // Short, satisfying medal pickup: a soft thunk followed by a bright chime.
  playTone(context, {
    frequency: 190,
    endFrequency: 125,
    startTime: now,
    duration: 0.11,
    gain: 0.1,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.C6,
    endFrequency: SCALE.E6,
    startTime: now + 0.035,
    duration: 0.14,
    gain: 0.07,
    type: "sine",
  });
}

function resultActionPress(context: AudioContext, now: number, playbackRate = 1) {
  // Deeper, longer UI press: a rounded body hit followed by a clean upward tick.
  const rate = Math.max(0.5, Math.min(playbackRate, 2.5));
  playNoise(context, {
    startTime: now,
    duration: 0.07 / rate,
    gain: 0.08,
    filterFrequency: 420,
  });
  playTone(context, {
    frequency: 155 * rate,
    endFrequency: 105 * rate,
    startTime: now,
    duration: 0.12 / rate,
    gain: 0.15,
    type: "triangle",
  });
  playTone(context, {
    frequency: 560 * rate,
    endFrequency: 860 * rate,
    startTime: now + 0.035 / rate,
    duration: 0.18 / rate,
    gain: 0.085,
    type: "sine",
  });
}

function resultCardReveal(context: AudioContext, now: number) {
  // Short, airy reveal cue for each result card entering the summary.
  playTone(context, {
    frequency: 320,
    endFrequency: 220,
    startTime: now,
    duration: 0.075,
    gain: 0.04,
    type: "triangle",
  });
  playTone(context, {
    frequency: SCALE.G5,
    endFrequency: SCALE.C6,
    startTime: now + 0.018,
    duration: 0.14,
    gain: 0.045,
    type: "sine",
  });
  playTone(context, {
    frequency: SCALE.E6,
    startTime: now + 0.045,
    duration: 0.12,
    gain: 0.025,
    type: "triangle",
  });
}

const EFFECT_SYNTHESIZERS: Record<SoundEffectName, (context: AudioContext, now: number, playbackRate?: number) => void> = {
  correct,
  incorrect,
  "rank-up-opening": rankUpOpening,
  "rank-up-reveal": rankUpReveal,
  points,
  learned,
  confetti,
  "quiz-complete": quizComplete,
  "mission-passed": missionPassed,
  "quiz-medals-complete": quizMedalsComplete,
  "quiz-medal-reveal": quizMedalReveal,
  "quiz-completion-progress-pop": quizCompletionProgressPop,
  "quiz-select": quizSelect,
  "word-select": wordSelect,
  "word-repetition-complete": resultActionPress,
  "streak-count-reveal": streakCountReveal,
  "rank-highlight": rankHighlight,
  "bonus-select": bonusSelect,
  "bonus-reward-loot": resultActionPress,
  "bonus-invalid-operation": bonusInvalidOperation,
  "pricing-perk-select": pricingPerkSelect,
  "card-swipe-right": cardSwipeRight,
  "card-swipe-left": cardSwipeLeft,
  "chest-tap": chestTap,
  "chest-open": chestOpen,
  "chest-crack": chestCrack,
  "clock-tick-low": clockTickLow,
  "clock-tick-high": clockTickHigh,
  "level-fail": levelFail,
  "mission-claim": missionClaim,
  "gem-loot": gemLoot,
  "gem-spend": gemSpend,
  "result-medal-collect": resultMedalCollect,
  "result-action-press": resultActionPress,
  "result-card-reveal": resultCardReveal,
};

export function playSoundEffect(effect: SoundEffectName, options?: { playbackRate?: number }) {
  if (!SOUND_EFFECTS_ENABLED) {
    return;
  }

  if (playAudioFile(effect, options?.playbackRate)) {
    return;
  }

  playSynthesizedEffect(effect, options?.playbackRate);
}

// Kept for tests and any future introspection.
export const SOUND_EFFECT_SYNTHESIZERS = EFFECT_SYNTHESIZERS;
