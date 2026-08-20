import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeAutomationMusicVideoAudioSession,
  isAutomationMusicVideoAudioContext,
  prepareAutomationMusicVideoAudio,
  releaseMusicVideoAudioContext,
  unlockAutomationMusicVideoAudio,
} from "./automation-music-video-audio-session";

class FakeAudioContext {
  static created = 0;
  state: AudioContextState = "suspended";
  destination = {} as AudioDestinationNode;
  close = vi.fn(async () => { this.state = "closed"; });
  resume = vi.fn(async () => { this.state = "running"; });

  constructor() {
    FakeAudioContext.created += 1;
  }

  createGain() {
    const gain = { value: 1 } as AudioParam;
    return { gain, connect: vi.fn(() => this.destination), disconnect: vi.fn() } as unknown as GainNode;
  }

  createConstantSource() {
    const offset = { value: 0 } as AudioParam;
    return { offset, connect: vi.fn((destination: GainNode) => destination), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() } as unknown as ConstantSourceNode;
  }
}

describe("automation music video audio session", () => {
  afterEach(async () => {
    await closeAutomationMusicVideoAudioSession();
    FakeAudioContext.created = 0;
    vi.unstubAllGlobals();
  });

  it("reuses the user-activated context instead of opening a context per queued video", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const unlocked = unlockAutomationMusicVideoAudio();
    const prepared = await prepareAutomationMusicVideoAudio();

    expect(prepared).toBe(unlocked);
    expect(FakeAudioContext.created).toBe(1);
    expect(isAutomationMusicVideoAudioContext(prepared)).toBe(true);

    await releaseMusicVideoAudioContext(prepared);
    expect(prepared.state).toBe("running");

    await closeAutomationMusicVideoAudioSession();
    expect(prepared.state).toBe("closed");
  });
});
