import { describe, expect, it, vi } from "vitest";
import {
  playSoundEffect,
  preloadSoundEffects,
  SOUND_EFFECT_SYNTHESIZERS,
  type SoundEffectName,
} from "@/lib/sound-effects";

const EFFECT_NAMES: SoundEffectName[] = [
  "correct",
  "incorrect",
  "rank-up-opening",
  "rank-up-reveal",
  "points",
  "learned",
  "card-progress-complete",
  "confetti",
  "quiz-complete",
  "mission-passed",
  "quiz-medals-complete",
  "quiz-medal-reveal",
  "quiz-completion-progress-pop",
  "quiz-select",
  "word-select",
  "word-repetition-complete",
  "streak-count-reveal",
  "rank-highlight",
  "bonus-select",
  "bonus-reward-loot",
  "bonus-invalid-operation",
  "pricing-perk-select",
  "card-swipe-right",
  "card-swipe-left",
  "chest-tap",
  "chest-open",
  "chest-crack",
  "clock-tick-low",
  "clock-tick-high",
  "level-fail",
  "mission-claim",
  "quiz-reward-box-pulse",
  "gem-loot",
  "gem-spend",
  "result-medal-collect",
  "result-action-press",
  "result-card-reveal",
  "quiz-result-point-award",
];

describe("SOUND_EFFECT_SYNTHESIZERS", () => {
  it("covers every sound effect key", () => {
    const synthesizerKeys = Object.keys(SOUND_EFFECT_SYNTHESIZERS).sort();
    expect(synthesizerKeys).toEqual([...EFFECT_NAMES].sort());
  });

  it("each synthesizer is a function", () => {
    for (const name of EFFECT_NAMES) {
      expect(typeof SOUND_EFFECT_SYNTHESIZERS[name]).toBe("function");
    }
  });

  it("raises the synthesized mission-claim reward pitch when playback rate increases", () => {
    const playedFrequencies: number[] = [];
    const createGain = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    });
    const context = {
      sampleRate: 1_000,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn((frequency: number) => playedFrequencies.push(frequency)),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(createGain),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(50) })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
    } as unknown as AudioContext;

    SOUND_EFFECT_SYNTHESIZERS["mission-claim"](context, 0, 1);
    const initialPitch = playedFrequencies[0];
    playedFrequencies.length = 0;
    SOUND_EFFECT_SYNTHESIZERS["mission-claim"](context, 0, 1.5);

    expect(playedFrequencies[0]).toBeCloseTo(initialPitch * 1.5);
  });
});

describe("playSoundEffect", () => {
  it("does not throw when AudioContext is unavailable", () => {
    expect(() => playSoundEffect("correct")).not.toThrow();
  });

  it("does not throw for any effect when AudioContext is unavailable", () => {
    for (const name of EFFECT_NAMES) {
      expect(() => playSoundEffect(name)).not.toThrow();
    }
  });

  it("resumes a suspended audio context and schedules oscillators", () => {
    const resumeMock = vi.fn();
    const currentTimeMock = vi.fn().mockReturnValue(0);
    const destinationMock = { connect: vi.fn() };
    const createOscillatorMock = vi.fn().mockReturnValue({
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    const createGainMock = vi.fn().mockReturnValue({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    });

    class MockAudioContext {
      state = "suspended";
      currentTime = currentTimeMock();
      resume = resumeMock;
      destination = destinationMock;
      createOscillator = createOscillatorMock;
      createGain = createGainMock;
    }

    function MockAudioContextConstructor() {
      return new MockAudioContext();
    }

    const originalAudioContext = (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = vi.fn(MockAudioContextConstructor);

    try {
      expect(() => playSoundEffect("correct")).not.toThrow();
      expect(resumeMock).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext;
    }
  });

  it("uses an immediate synthesized fallback until the bonus reward audio is ready", () => {
    const originalAudioDescriptor = Object.getOwnPropertyDescriptor(window, "Audio");
    const originalAudioContextDescriptor = Object.getOwnPropertyDescriptor(window, "AudioContext");
    const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
    const audioInstances: Array<{
      readyState: number;
      load: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
    }> = [];

    class MockAudio {
      preload = "";
      readyState = 0;
      volume = 1;
      playbackRate = 1;
      currentTime = 0;
      preservesPitch = true;
      mozPreservesPitch = true;
      webkitPreservesPitch = true;
      load = vi.fn();
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      addEventListener = vi.fn();

      constructor() {
        audioInstances.push(this);
      }
    }

    class MockAudioContext {
      state = "running";
      currentTime = 0;
      resume = vi.fn();
    }

    Object.defineProperty(window, "Audio", { configurable: true, writable: true, value: MockAudio });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });

    const synthesizedFallback = vi.spyOn(SOUND_EFFECT_SYNTHESIZERS, "bonus-reward-loot").mockImplementation(() => {});

    try {
      preloadSoundEffects(["bonus-reward-loot"]);
      expect(audioInstances).toHaveLength(1);
      expect(audioInstances[0]?.load).toHaveBeenCalledOnce();

      playSoundEffect("bonus-reward-loot");
      expect(audioInstances[0]?.play).not.toHaveBeenCalled();
      expect(synthesizedFallback).toHaveBeenCalledOnce();

      audioInstances[0]!.readyState = 3;
      playSoundEffect("bonus-reward-loot");
      expect(audioInstances[0]?.play).toHaveBeenCalledOnce();
      expect(synthesizedFallback).toHaveBeenCalledOnce();
    } finally {
      synthesizedFallback.mockRestore();
      if (originalAudioDescriptor) Object.defineProperty(window, "Audio", originalAudioDescriptor);
      else Reflect.deleteProperty(window, "Audio");
      if (originalAudioContextDescriptor) Object.defineProperty(window, "AudioContext", originalAudioContextDescriptor);
      else Reflect.deleteProperty(window, "AudioContext");
      if (originalUserAgentDescriptor) Object.defineProperty(navigator, "userAgent", originalUserAgentDescriptor);
    }
  });
});
