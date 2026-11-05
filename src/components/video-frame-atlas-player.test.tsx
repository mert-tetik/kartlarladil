import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VideoFrameAtlasPlayer,
  type VideoFrameAtlasPlayerHandle,
} from "@/components/video-frame-atlas-player";

vi.mock("@/lib/video-frame-atlas-assets", () => ({
  VIDEO_FRAME_ATLAS_ASSETS: {
    "tutorial-welcome": { frameCount: 1, fps: 24, frameWidth: 2, frameHeight: 2, columns: 1, rows: 1 },
  },
  getVideoFrameAtlasCount: () => 1,
  getVideoFrameAtlasSource: () => "/video-frame-atlases/tutorial-welcome/atlas-001.webp?v=test",
}));

const decodeAtlas: Array<() => void> = [];

class DeferredImage {
  decoding = "async";
  loading = "eager";
  fetchPriority = "auto";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  decode() {
    return new Promise<void>((resolve) => decodeAtlas.push(resolve));
  }
}

function PlayerHarness({ onPlay, onReady }: { onPlay: () => void; onReady?: () => void }) {
  const playerRef = createRef<VideoFrameAtlasPlayerHandle>();

  return (
    <>
      <VideoFrameAtlasPlayer ref={playerRef} assetId="tutorial-welcome" onPlay={onPlay} onReady={onReady} />
      <button type="button" onClick={() => playerRef.current?.play()}>play</button>
      <button type="button" onClick={() => playerRef.current?.pause()}>pause</button>
    </>
  );
}

describe("VideoFrameAtlasPlayer", () => {
  afterEach(() => {
    decodeAtlas.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cancels a play queued before the atlas is ready when paused", async () => {
    vi.stubGlobal("Image", DeferredImage);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const onPlay = vi.fn();
    const onReady = vi.fn();
    const drawImage = vi.fn();
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    render(<PlayerHarness onPlay={onPlay} onReady={onReady} />);

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    expect(onPlay).not.toHaveBeenCalled();

    await act(async () => {
      decodeAtlas[0]?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(drawImage).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.invocationCallOrder[0]).toBeGreaterThan(drawImage.mock.invocationCallOrder[0]);
    expect(onPlay).not.toHaveBeenCalled();
    // Readiness is reported only after drawImage paints the initial atlas frame.
    expect(drawImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
