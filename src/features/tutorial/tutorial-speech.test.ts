import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockAudio {
  static instances: MockAudio[] = [];

  readonly src: string;
  preload = "";
  currentTime = 0;
  paused = true;
  ended = false;
  onended: (() => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onpause: (() => void) | null = null;
  readonly play = vi.fn(async () => {
    this.paused = false;
  });
  readonly pause = vi.fn(() => {
    this.paused = true;
  });
  readonly load = vi.fn();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  finish() {
    this.ended = true;
    this.paused = true;
    this.onended?.();
  }
}

type TutorialSpeechModule = typeof import("@/features/tutorial/tutorial-speech");

describe("tutorial speech playback", () => {
  let tutorialSpeech: TutorialSpeechModule;

  beforeEach(async () => {
    vi.resetModules();
    MockAudio.instances = [];
    vi.stubGlobal("Audio", MockAudio);
    tutorialSpeech = await import("@/features/tutorial/tutorial-speech");
  });

  afterEach(() => {
    tutorialSpeech.stopTutorialSpeech();
    vi.unstubAllGlobals();
  });

  it("lets the current sentence finish before starting speech from the next screen", () => {
    tutorialSpeech.playTutorialSpeech("landing-cards-action", "tr");
    const firstAudio = MockAudio.instances[0];

    tutorialSpeech.playTutorialSpeech("landing-cards-message", "tr");

    expect(firstAudio).toBeDefined();
    expect(firstAudio.play).toHaveBeenCalledOnce();
    expect(firstAudio.pause).not.toHaveBeenCalled();
    expect(MockAudio.instances).toHaveLength(1);

    firstAudio.finish();

    expect(MockAudio.instances).toHaveLength(2);
    expect(MockAudio.instances[1].play).toHaveBeenCalledOnce();
  });

  it("clears queued speech only when the tutorial is explicitly stopped", () => {
    tutorialSpeech.playTutorialSpeech("landing-cards-action", "tr");
    const firstAudio = MockAudio.instances[0];
    tutorialSpeech.playTutorialSpeech("landing-cards-message", "tr");

    tutorialSpeech.stopTutorialSpeech();
    firstAudio.finish();

    expect(firstAudio.pause).toHaveBeenCalledOnce();
    expect(MockAudio.instances).toHaveLength(1);
  });
});
