import { act, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
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
  loadChestOpeningFrameImage: vi.fn(() => new Promise<HTMLImageElement>(() => undefined)),
  preloadChestOpeningFrames: vi.fn(() => Promise.resolve()),
}));

describe("ChestOpeningView", () => {
  let queuedAnimationFrame: FrameRequestCallback | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    queuedAnimationFrame = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      queuedAnimationFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function advanceOpeningTo(timestamp: number) {
    const callback = queuedAnimationFrame;
    queuedAnimationFrame = null;
    if (callback) act(() => callback(timestamp));
  }

  it("plays tier frames with their audio and reveals rewards at the 3-second mark", () => {
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

  it("starts the frame-and-audio timeline from the external chest-open click", () => {
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

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("holds the final frame for two seconds before starting the smooth close", () => {
    const onComplete = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <ChestOpeningView tier={CHEST_TIERS[1]} totalPoints={0} onComplete={onComplete} />
      </LocaleProvider>,
    );

    const startTime = window.performance.now();
    advanceOpeningTo(startTime + 4042);

    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");

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

  it("skips the opening frames on a touch double tap and reveals the rewards immediately", () => {
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

    act(() => {
      fireEvent.pointerUp(view!, { pointerType: "touch" });
      vi.advanceTimersByTime(100);
      fireEvent.pointerUp(view!, { pointerType: "touch" });
    });

    expect(document.querySelector("[data-chest-reward-sources]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-frames]")).toBeInTheDocument();
    expect(document.querySelector("[data-chest-opening-view]")).not.toHaveClass("animate-chest-screen-close");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
