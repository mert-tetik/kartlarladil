export type SoundEffectName = "correct" | "incorrect" | "rank-up";

interface BrowserAudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | null = null;

export function playSoundEffect(effect: SoundEffectName) {
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

    playRankUpEffect(context);
  } catch {
    // Audio feedback should never block quiz or navigation interactions.
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
