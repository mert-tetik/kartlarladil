import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizStreakRewardView } from "./quiz-streak-reward-view";

const mocks = vi.hoisted(() => ({
  prepareGemRewardDisplay: vi.fn(),
  handleGemArrive: vi.fn(),
  finishGemRewardDisplay: vi.fn(),
  refreshProfile: vi.fn(),
  updateProfileField: vi.fn(),
}));

vi.mock("react-dom", () => ({
  createPortal: (children: unknown) => children,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({
    user: null,
    refreshProfile: mocks.refreshProfile,
    updateProfileField: mocks.updateProfileField,
  }),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}));

vi.mock("@/features/progress/components/reward-gem-hud", () => ({
  RewardGemHud: () => null,
  useGemRewardDisplay: () => ({
    balances: { blue: 0, green: 0, purple: 0 },
    pulse: 0,
    prepare: mocks.prepareGemRewardDisplay,
    handleGemArrive: mocks.handleGemArrive,
    finish: mocks.finishGemRewardDisplay,
  }),
}));

vi.mock("@/features/progress/components/gem-reward-flight", () => ({
  GemRewardFlight: () => null,
}));

vi.mock("@/features/gems/gem-actions", () => ({
  awardProgressGemRewardAction: vi.fn(),
}));

vi.mock("@/components/score-icon", () => ({
  ScoreIcon: () => <span data-score-icon />,
}));

vi.mock("lucide-react", () => ({
  Flame: () => <span data-flame />,
  Star: () => <span data-star />,
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

vi.mock("@/lib/super-water", () => ({
  canUseSuperWater: () => false,
  formatSuperWaterText: (_locale: string, value: string) => value,
}));

vi.mock("@/features/quiz/streak-rigid-body", () => ({
  createStreakExitMotion: () => ({
    number: { x: 0, y: 0, velocityX: 0, velocityY: 0, rotation: 0, angularVelocity: 0 },
    icon: { x: 0, y: 0, velocityX: 0, velocityY: 0, rotation: 0, angularVelocity: 0 },
  }),
  stepRigidBody: vi.fn(),
}));

function renderReward(onComplete = vi.fn()) {
  const view = render(
    <QuizStreakRewardView
      streak={5}
      points={20}
      totalPoints={1000}
      testMode
      testGemRewards={[]}
      onComplete={onComplete}
    />,
  );
  const videos = view.container.querySelectorAll("video");
    const video = videos[0];
    const continuationVideo = videos[1];
    if (!video || !continuationVideo) throw new Error("Reward video segments were not rendered");
    const audios = view.container.querySelectorAll("audio");
    expect(audios).toHaveLength(2);
    expect(continuationVideo).toHaveProperty("muted", true);
    expect(audios[1]).toHaveAttribute(
      "src",
      "/quiz/streak-reward-background-20260921-continuation-audio.m4a?v=20261007-2",
    );

  // jsdom does not calculate layout, but the shared scatter controller needs
  // real source/target geometry before it can render flight particles.
  const scatterSource = view.container.querySelector<HTMLElement>("[data-quiz-streak-scatter-source]");
  const pointsTarget = view.container.querySelector<HTMLElement>("[data-main-points-display] > span");
  if (!scatterSource || !pointsTarget) throw new Error("Reward scatter anchors were not rendered");
  scatterSource.getBoundingClientRect = () => new DOMRect(120, 300, 180, 120);
  pointsTarget.getBoundingClientRect = () => new DOMRect(140, 30, 160, 50);

  Object.defineProperty(video, "duration", { configurable: true, value: 64 / 30 });
  Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.play(video);
  return { ...view, video, continuationVideo, onComplete };
}

describe("QuizStreakRewardView timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("holds the first segment at its last frame until the user continues", () => {
    const { container, video, continuationVideo, onComplete } = renderReward();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(video.className).toContain("animate-streak-reward-video-enter");
    expect(container.querySelector(".animate-streak-reward-break")).toBeNull();

    Object.defineProperty(video, "paused", { configurable: true, value: true });
    Object.defineProperty(video, "ended", { configurable: true, value: true });
    Object.defineProperty(continuationVideo, "duration", {
      configurable: true,
      value: 1.933,
    });
    Object.defineProperty(continuationVideo, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });
    fireEvent.pointerUp(container.querySelector("[data-streak-reward-view]")!);
    fireEvent.play(continuationVideo);

    expect(container.querySelector(".animate-streak-reward-break")).not.toBeNull();

    act(() => {
      Object.defineProperty(continuationVideo, "currentTime", {
        configurable: true,
        writable: true,
        value: 1.9,
      });
      fireEvent.timeUpdate(continuationVideo);
      vi.advanceTimersByTime(0);
    });
    expect(continuationVideo.className).toContain("animate-streak-reward-video-exit");

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(container.querySelector(".animate-streak-reward-ui-exit")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.querySelector(".animate-streak-reward-ui-exit")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("aligns the fade start with the video's actual end time", () => {
    const { container, video, continuationVideo } = renderReward();

    Object.defineProperty(video, "paused", { configurable: true, value: true });
    Object.defineProperty(video, "ended", { configurable: true, value: true });
    fireEvent.pointerUp(container.querySelector("[data-streak-reward-view]")!);
    Object.defineProperty(continuationVideo, "duration", {
      configurable: true,
      value: 1.933,
    });

    Object.defineProperty(continuationVideo, "currentTime", {
      configurable: true,
      writable: true,
      value: 1.9,
    });
    act(() => {
      fireEvent.play(continuationVideo);
      fireEvent.timeUpdate(continuationVideo);
    });

    expect(continuationVideo.className).toContain("opacity-100");

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(continuationVideo.className).toContain("animate-streak-reward-video-exit");
  });
});
