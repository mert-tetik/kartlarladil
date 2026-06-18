export type SoundEffectName = "correct" | "incorrect" | "rank-up" | "points" | "learned" | "confetti" | "quiz-complete";

interface BrowserAudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | null = null;

export function playSoundEffect(effect: SoundEffectName) {
  if (effect === "points") {
    playPointsEffect();
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

    if (effect === "correct") {
      playCorrectEffect(context);
      return;
    }

    if (effect === "incorrect") {
      playIncorrectEffect(context);
      return;
    }

    if (effect === "learned") {
      playLearnedEffect(context);
      return;
    }

    if (effect === "confetti") {
      playConfettiEffect(context);
      return;
    }

    if (effect === "quiz-complete") {
      playQuizCompleteEffect(context);
      return;
    }

    playRankUpEffect(context);
  } catch {
    // Audio feedback should never block quiz or navigation interactions.
  }
}

function playPointsEffect() {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return;
  }

  try {
    const audio = new Audio("/sounds/points.mp3");
    audio.volume = 0.35;
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

function playIncorrectEffect(context: AudioContext) {
  const now = context.currentTime;

  playTone(context, { frequency: 260, endFrequency: 170, startTime: now, duration: 0.18, gain: 0.075, type: "sawtooth" });
  playTone(context, { frequency: 145, startTime: now + 0.08, duration: 0.12, gain: 0.045, type: "triangle" });
}

function playRankUpEffect(context: AudioContext) {
  const now = context.currentTime;
  const notes = [392, 523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + index * 0.07,
      duration: 0.22,
      gain: index === notes.length - 1 ? 0.09 : 0.065,
      type: index % 2 === 0 ? "triangle" : "sine",
    });
  });
}

function playLearnedEffect(context: AudioContext) {
  const now = context.currentTime;
  // Short, crisp "chess piece snap" style thock: low-mid click + higher harmonic.
  playTone(context, { frequency: 420, startTime: now, duration: 0.06, gain: 0.12, type: "triangle" });
  playTone(context, { frequency: 840, startTime: now + 0.015, duration: 0.05, gain: 0.08, type: "sine" });
  playTone(context, { frequency: 1260, startTime: now + 0.03, duration: 0.04, gain: 0.05, type: "sine" });
}

function playQuizCompleteEffect(context: AudioContext) {
  const now = context.currentTime;
  // Short, satisfying success fanfare.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => {
    playTone(context, {
      frequency,
      startTime: now + index * 0.08,
      duration: 0.18,
      gain: index === notes.length - 1 ? 0.1 : 0.07,
      type: index % 2 === 0 ? "triangle" : "sine",
    });
  });
}

function playConfettiEffect(context: AudioContext) {
  const now = context.currentTime;
  const duration = 0.18;
  const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2800;
  bandpass.Q.value = 0.8;

  const gainNode = context.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(now);
  source.stop(now + duration);
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
