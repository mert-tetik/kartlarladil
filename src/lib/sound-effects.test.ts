import { describe, expect, it, vi } from "vitest";
import { playSoundEffect, SOUND_EFFECT_SYNTHESIZERS, type SoundEffectName } from "@/lib/sound-effects";

const EFFECT_NAMES: SoundEffectName[] = [
  "correct",
  "incorrect",
  "rank-up",
  "points",
  "learned",
  "confetti",
  "quiz-complete",
  "chest-tap",
  "chest-open",
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
});
