import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileDayStreakMenu } from "@/app/components/mobile-day-streak-menu";

const { loadAtlasMock, preloadFramesMock } = vi.hoisted(() => ({
  loadAtlasMock: vi.fn(),
  preloadFramesMock: vi.fn(),
}));

vi.mock("@/components/theme-provider", () => ({ useTheme: () => ({ mode: "dark" }) }));
vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string) => key,
}));
vi.mock("@/features/daily-streak/day-streak-opening-frames", async () => {
  const actual = await vi.importActual<typeof import("@/features/daily-streak/day-streak-opening-frames")>(
    "@/features/daily-streak/day-streak-opening-frames",
  );
  return {
    ...actual,
    loadDayStreakOpeningAtlasImage: loadAtlasMock,
    preloadDayStreakFrames: preloadFramesMock,
  };
});

describe("MobileDayStreakMenu", () => {
  let nextFrame: FrameRequestCallback | null;
  const drawImage = vi.fn();
  const audioPlay = vi.fn(() => Promise.resolve());
  const audioPause = vi.fn();

  beforeEach(() => {
    nextFrame = null;
    drawImage.mockClear();
    audioPlay.mockReset().mockResolvedValue(undefined);
    audioPause.mockClear();
    preloadFramesMock.mockClear();
    loadAtlasMock.mockReset().mockImplementation(async () => document.createElement("img"));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(audioPlay);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(audioPause);
  });

  afterEach(() => vi.restoreAllMocks());

  it("plays the WebP frame atlas with synchronized audio and reveals content on the original timeline", async () => {
    render(
      <MobileDayStreakMenu
        open
        onClose={vi.fn()}
        snapshot={{ today: "2026-11-03", currentStreak: 3, loggedDates: [] }}
      />,
    );

    await waitFor(() => expect(audioPlay).toHaveBeenCalledOnce());
    const dialog = document.querySelector("[data-mobile-day-streak-menu]");
    const canvas = document.querySelector("[data-day-streak-background-frames]");
    const audio = document.querySelector("[data-day-streak-audio]");
    expect(dialog).toBeInTheDocument();
    expect(canvas).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(audio).toHaveAttribute("src", "/day-streak/daily_streak_sfx.mp3?v=20261009-1");
    expect(drawImage).toHaveBeenCalled();

    const firstFrame = nextFrame;
    expect(firstFrame).toEqual(expect.any(Function));
    const startedAt = window.performance.now();
    act(() => firstFrame?.(startedAt + 2_600));
    expect(dialog).toHaveAttribute("data-day-streak-content-ready", "true");

    const finalFrame = nextFrame;
    act(() => finalFrame?.(startedAt + 4_100));
    expect(dialog).toHaveAttribute("data-mobile-day-streak-phase", "open");
    expect(audioPause).toHaveBeenCalled();
  });

  it("keeps the touch double-tap skip behavior", async () => {
    render(
      <MobileDayStreakMenu
        open
        onClose={vi.fn()}
        snapshot={{ today: "2026-11-03", currentStreak: 1, loggedDates: [] }}
      />,
    );

    await waitFor(() => expect(audioPlay).toHaveBeenCalledOnce());
    const dialog = document.querySelector("[data-mobile-day-streak-menu]")!;
    fireEvent.pointerUp(dialog, { pointerType: "touch" });
    fireEvent.pointerUp(dialog, { pointerType: "touch" });

    expect(dialog).toHaveAttribute("data-mobile-day-streak-phase", "open");
    expect(audioPause).toHaveBeenCalled();
  });
});
