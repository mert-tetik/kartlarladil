import { beforeEach, describe, expect, it, vi } from "vitest";
import { playFlowButtonSound, resetFlowButtonSoundSequence } from "@/lib/flow-button-sound";
import { playSoundEffect } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));

describe("flow button sound", () => {
  beforeEach(() => {
    vi.mocked(playSoundEffect).mockClear();
    resetFlowButtonSoundSequence("auth");
    resetFlowButtonSoundSequence("tutorial");
  });

  it("raises the pitch on each press using the quiz result sound", () => {
    playFlowButtonSound("auth");
    playFlowButtonSound("auth");
    playFlowButtonSound("auth");

    expect(playSoundEffect).toHaveBeenNthCalledWith(1, "result-action-press", { playbackRate: 0.9 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(2, "result-action-press", { playbackRate: 1 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(3, "result-action-press", { playbackRate: 1.1 });
  });

  it("keeps auth and tutorial pitch sequences independent and resets them separately", () => {
    playFlowButtonSound("auth");
    playFlowButtonSound("auth");
    playFlowButtonSound("tutorial");
    resetFlowButtonSoundSequence("tutorial");
    playFlowButtonSound("tutorial");
    playFlowButtonSound("auth");

    expect(playSoundEffect).toHaveBeenNthCalledWith(1, "result-action-press", { playbackRate: 0.9 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(2, "result-action-press", { playbackRate: 1 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(3, "result-action-press", { playbackRate: 0.9 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(4, "result-action-press", { playbackRate: 0.9 });
    expect(playSoundEffect).toHaveBeenNthCalledWith(5, "result-action-press", { playbackRate: 1.1 });
  });
});
