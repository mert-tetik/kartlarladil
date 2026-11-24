import { act, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect, preloadSoundEffects } from "@/lib/sound-effects";
import { loadChestOpeningFrameImage } from "@/features/quiz/chest-opening-frames";
import {
  NATIVE_MEDIA_LOCAL_HIT_EVENT,
  NATIVE_MEDIA_LOCAL_MISS_EVENT,
} from "@/lib/native-media-fallback";

const { showAppMessage } = vi.hoisted(() => ({ showAppMessage: vi.fn() }));

vi.mock("@/components/app-message-provider", () => ({
  useAppMessage: () => ({ showMessage: showAppMessage }),
}));

function createMockFrame(source: string) {
  return {
    src: source,
    naturalWidth: 480,
    naturalHeight: 854,
  } as HTMLImageElement;
}

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
  preloadSoundEffects: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

vi.mock("@/features/quiz/chest-opening-frames", () => ({
  CHEST_OPENING_DURATION_SECONDS: 97 / 24,
  CHEST_OPENING_FRAME_COUNT: 97,
  CHEST_OPENING_FRAME_HEIGHT: 854,
  CHEST_OPENING_FRAME_PREFETCH_AHEAD: 6,
  CHEST_OPENING_FRAME_RATE: 24,
  CHEST_OPENING_FRAME_WIDTH: 480,
  getChestOpeningFrameSource: vi.fn((_tier: string, frameIndex: number) =>
    `/chests/opening-frames/wood-frames/frame-${String(frameIndex + 1).padStart(3, "0")}.webp`,
  ),
  loadChestOpeningFrameImage: vi.fn(async (source: string) => createMockFrame(source)),
  preloadChestOpeningFrames: vi.fn(() => Promise.resolve()),
}));

describe("ChestOpeningView", () => {
  let queuedAnimationFrame: FrameRequestCallback | null = null;
  let drawImageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    showAppMessage.mockReset();
    vi.mocked(loadChestOpeningFrameImage).mockImplementation(async (source) => createMockFrame(source));
    queuedAnimationFrame = null;
    drawImageMock = vi.fn();
    const canvasContext = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: drawImageMock,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      queuedAnimationFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => canvasContext);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    delete (window as Window & {
      __foxiesDeckNativeMediaDiagnostics?: Record<string, unknown>;
    }).__foxiesDeckNativeMediaDiagnostics;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function advanceOpeningTo(timestamp: number) {
    const callback = queuedAnimationFrame;
    queuedAnimationFrame = null;
    if (callback) act(() => callback(timestamp));
  }

  async function flushFrameLoads() {
    await act(async () => {
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
  }

  it("plays tier frames with their audio and reveals rewards at the 3-second mark", async () => {
    const onComplete = vi.fn();
    const reward = {
      points: 20,
      rewards: [
        { type: "blue" as const, amount: 2 },
        { type: "purple" as const, amount: 1 },
      ],
      balances: { blue: 2, green: 0, purple: 1 },
    };

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={100}
          reward={reward}
          onComplete={onComplete}
        />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector("audio")).toHaveAttribute(
      "src",
      "/chests/openings/wood_chest_opening_v2.m4a?v=20261007-2",
    );
    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 2999);
    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();

    advanceOpeningTo(startTime + 3000);

    expect(document.querySelector("[data-chest-reward-sources]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-reward-heading]")).toHaveTextContent("YOUR REWARDS");
    expect(document.querySelectorAll("[data-chest-reward-boxes] > div")).toHaveLength(3);
    expect(document.querySelector("[data-chest-reward-points]")).toHaveTextContent("20");
    expect(document.querySelector('[data-chest-reward-gem="blue"]')).toHaveTextContent("2");
    expect(document.querySelector('[data-chest-reward-gem="purple"]')).toHaveTextContent("1");
    expect(document.querySelector("[data-reward-gem-hud]")).not.toHaveClass("opacity-0");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("starts the frame-and-audio timeline from the external chest-open click after drawing frame one", async () => {
    let startOpening: (() => void) | null = null;

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          autoPlay={false}
          onOpeningReady={(start) => {
            startOpening = start;
          }}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(startOpening).toEqual(expect.any(Function));

    act(() => startOpening?.());
    await flushFrameLoads();

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(drawImageMock).toHaveBeenCalled();
  });

  it("holds the final frame for two seconds before starting the smooth close", async () => {
    const onComplete = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[1]} totalPoints={0} onComplete={onComplete} />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 4042);

    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");
    expect(playSoundEffect).not.toHaveBeenCalledWith("chest-skipped");

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector("[data-chest-opening-view]")).toHaveClass("animate-chest-screen-close");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("holds the opening timeline until the first frame has decoded and been painted", async () => {
    const onComplete = vi.fn();
    let resolveFirstFrame: ((image: HTMLImageElement) => void) | null = null;
    const firstFramePromise = new Promise<HTMLImageElement>((resolve) => {
      resolveFirstFrame = resolve;
    });
    vi.mocked(loadChestOpeningFrameImage).mockImplementation((source) => {
      if (source.includes("frame-001.webp")) return firstFramePromise;
      return Promise.resolve(createMockFrame(source));
    });

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={0} onComplete={onComplete} />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(drawImageMock).not.toHaveBeenCalled();
    expect(queuedAnimationFrame).toBeNull();
    expect(loadChestOpeningFrameImage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstFrame?.(createMockFrame("/chests/opening-frames/wood-frames/frame-001.webp"));
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(drawImageMock).toHaveBeenCalledTimes(1);
    expect(loadChestOpeningFrameImage).toHaveBeenCalledTimes(7);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(queuedAnimationFrame).toEqual(expect.any(Function));
  });

  it("does not retry or start a stale frame request after the chest view unmounts", async () => {
    let resolveFirstFrame: ((image: HTMLImageElement) => void) | null = null;
    const firstFramePromise = new Promise<HTMLImageElement>((resolve) => {
      resolveFirstFrame = resolve;
    });
    vi.mocked(loadChestOpeningFrameImage).mockImplementation(() => firstFramePromise);

    const { unmount } = render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={0} onComplete={vi.fn()} />
      </LocaleProvider>,
    );
    await flushFrameLoads();
    expect(loadChestOpeningFrameImage).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      resolveFirstFrame?.(createMockFrame("/chests/opening-frames/wood-frames/frame-001.webp"));
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(loadChestOpeningFrameImage).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(queuedAnimationFrame).toBeNull();
  });

  it("plays the same real frame sequence through an image element when canvas is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={0} onComplete={vi.fn()} />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    const imageRenderer = document.querySelector<HTMLImageElement>("[data-chest-opening-image-fallback]");
    expect(imageRenderer).toBeInTheDocument();
    expect(imageRenderer).not.toHaveClass("hidden");
    expect(imageRenderer).toHaveAttribute("src", expect.stringContaining("frame-001.webp"));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    Object.defineProperty(imageRenderer, "naturalWidth", { configurable: true, value: 480 });
    Object.defineProperty(imageRenderer, "naturalHeight", { configurable: true, value: 854 });
    fireEvent.load(imageRenderer!);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 100);

    expect(imageRenderer).toHaveAttribute("src", expect.stringContaining("frame-003.webp"));
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(2);
  });

  it("releases old decoded frames while the image renderer advances", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const decodedFrames: HTMLImageElement[] = [];
    vi.mocked(loadChestOpeningFrameImage).mockImplementation(async (source) => {
      const frame = createMockFrame(source);
      decodedFrames.push(frame);
      return frame;
    });

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          debugFramePlayback
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    const imageRenderer = document.querySelector<HTMLImageElement>("[data-chest-opening-image-fallback]")!;
    Object.defineProperty(imageRenderer, "naturalWidth", { configurable: true, value: 480 });
    Object.defineProperty(imageRenderer, "naturalHeight", { configurable: true, value: 854 });
    fireEvent.load(imageRenderer);

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 2000);
    await flushFrameLoads();

    const debugText = document.querySelector("[data-chest-frame-debug]")?.textContent ?? "";
    const cachedFrameCount = Number(debugText.match(/cached (\d+)/)?.[1] ?? Number.NaN);
    expect(imageRenderer).toHaveAttribute("src", expect.stringContaining("frame-049.webp"));
    expect(decodedFrames[0]?.src).toBe("data:,");
    expect(cachedFrameCount).toBeLessThanOrEqual(8);
  });

  it("shows exact Android local-hit and local-miss frame paths in debug mode", () => {
    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          debugFramePlayback
          autoPlay={false}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(NATIVE_MEDIA_LOCAL_HIT_EVENT, {
        detail: { path: "/chests/opening-frames/wood-frames/frame-001.webp" },
      }));
      window.dispatchEvent(new CustomEvent(NATIVE_MEDIA_LOCAL_MISS_EVENT, {
        detail: { path: "/chests/opening-frames/wood-frames/frame-002.webp" },
      }));
    });

    expect(document.querySelector("[data-chest-frame-debug]")).toHaveTextContent(
      "Native local miss: /chests/opening-frames/wood-frames/frame-002.webp",
    );
    expect(document.querySelector("[data-chest-frame-debug]")).toHaveTextContent(
      "Native local hit: /chests/opening-frames/wood-frames/frame-001.webp",
    );
    expect(document.querySelector("[data-chest-frame-debug]")).toHaveTextContent(
      "Native local miss: /chests/opening-frames/wood-frames/frame-002.webp",
    );
  });

  it("shows native diagnostics emitted while chest frames were preloaded", () => {
    (window as Window & {
      __foxiesDeckNativeMediaDiagnostics?: Record<string, unknown>;
    }).__foxiesDeckNativeMediaDiagnostics = {
      [NATIVE_MEDIA_LOCAL_HIT_EVENT]: "/chests/opening-frames/wood-frames/frame-001.webp",
      [NATIVE_MEDIA_LOCAL_MISS_EVENT]: "/chests/opening-frames/wood-frames/frame-002.webp",
    };

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          debugFramePlayback
          autoPlay={false}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-chest-frame-debug]")).toHaveTextContent(
      "Native local hit: /chests/opening-frames/wood-frames/frame-001.webp",
    );
    expect(document.querySelector("[data-chest-frame-debug]")).toHaveTextContent(
      "Native local miss: /chests/opening-frames/wood-frames/frame-002.webp",
    );
  });

  it("retries a transient first-frame load failure once and then starts playback", async () => {
    let firstFrameAttempts = 0;
    vi.mocked(loadChestOpeningFrameImage).mockImplementation(async (source) => {
      if (source.includes("frame-001.webp") && firstFrameAttempts++ === 0) {
        throw new Error("Temporary local media read failure");
      }
      return createMockFrame(source);
    });

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={0} onComplete={vi.fn()} />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    expect(firstFrameAttempts).toBe(1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(drawImageMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(900);
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(firstFrameAttempts).toBe(2);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(drawImageMock).toHaveBeenCalledTimes(1);
  });

  it("shows a localized diagnostic with the packaged frame path after first-frame retries fail", async () => {
    vi.mocked(loadChestOpeningFrameImage).mockRejectedValue(new Error("decode failed"));
    let startOpening: (() => void) | null = null;

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          autoPlay={false}
          onOpeningReady={(start) => { startOpening = start; }}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    act(() => startOpening?.());
    await flushFrameLoads();
    expect(showAppMessage).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(900);
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(showAppMessage).toHaveBeenCalledTimes(1);
    expect(showAppMessage).toHaveBeenCalledWith(
      expect.stringContaining("/chests/opening-frames/wood-frames/frame-001.webp"),
      "error",
      8_000,
    );
  });

  it("uses the latest available decoded frame when the exact 24fps target is late", async () => {
    let resolveSeventhFrame: ((image: HTMLImageElement) => void) | null = null;
    const seventhFramePromise = new Promise<HTMLImageElement>((resolve) => {
      resolveSeventhFrame = resolve;
    });
    vi.mocked(loadChestOpeningFrameImage).mockImplementation((source) => {
      if (source.includes("frame-007.webp")) return seventhFramePromise;
      return Promise.resolve(createMockFrame(source));
    });

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[0]} totalPoints={0} onComplete={vi.fn()} />
      </LocaleProvider>,
    );
    await flushFrameLoads();

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 300);
    expect(drawImageMock).toHaveBeenCalled();
    const callsBeforeLateFrame = drawImageMock.mock.calls.length;

    await act(async () => {
      resolveSeventhFrame?.(createMockFrame("/chests/opening-frames/wood-frames/frame-007.webp"));
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(drawImageMock.mock.calls.length).toBeGreaterThan(callsBeforeLateFrame);
  });

  it("requires a double touch to skip the opening frames and reveal rewards", () => {
    const onComplete = vi.fn();
    const reward = {
      points: 20,
      rewards: [{ type: "blue" as const, amount: 2 }],
      balances: { blue: 2, green: 0, purple: 0 },
    };

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={100}
          reward={reward}
          onComplete={onComplete}
        />
      </LocaleProvider>,
    );

    const view = document.querySelector("[data-chest-opening-view]");
    expect(view).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(preloadSoundEffects).toHaveBeenCalledWith(["chest-skipped"]);

    act(() => {
      fireEvent.pointerUp(view!, { pointerType: "touch" });
    });

    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();
    expect(playSoundEffect).not.toHaveBeenCalledWith("chest-skipped");

    act(() => {
      fireEvent.pointerUp(view!, { pointerType: "touch" });
    });

    expect(document.querySelector("[data-chest-reward-sources]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");
    expect(onComplete).not.toHaveBeenCalled();
    expect(playSoundEffect).toHaveBeenCalledTimes(1);
    expect(playSoundEffect).toHaveBeenCalledWith("chest-skipped");
  });

  it("does not treat a dragged touch as a fast-forward tap", () => {
    const reward = {
      points: 20,
      rewards: [{ type: "blue" as const, amount: 2 }],
      balances: { blue: 2, green: 0, purple: 0 },
    };

    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView
          tier={CHEST_TIERS[0]}
          totalPoints={100}
          reward={reward}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    const view = document.querySelector("[data-chest-opening-view]")!;
    act(() => {
      fireEvent.pointerDown(view, { pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(view, { pointerType: "touch", button: 0, clientX: 30, clientY: 10 });
    });

    expect(document.querySelector("[data-chest-reward-sources]")).not.toBeInTheDocument();
  });
});
