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
  useLocale: () => ({ locale: "en" }),
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
      testGemRewards={[{ type: "blue", amount: 1 }]}
      onComplete={onComplete}
    />,
  );
  const video = view.container.querySelector("video");
  if (!video) throw new Error("Reward video was not rendered");

  Object.defineProperty(video, "duration", { configurable: true, value: 4.064 });
  Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.play(video);
  return { ...view, video, onComplete };
}

describe("QuizStreakRewardView timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the scatter 2.8 seconds after the screen opens and then closes", () => {
    const { container, onComplete } = renderReward();
    const video = container.querySelector("video")!;

    act(() => {
      vi.advanceTimersByTime(2799);
    });
    expect(video.className).toContain("animate-streak-reward-video-enter");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll(".animate-quiz-score-icon-flight").length).toBeGreaterThan(0);
    expect(container.querySelector(".animate-streak-reward-break")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1014);
    });
    expect(video.className).toContain("animate-streak-reward-video-exit");

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
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("aligns the fade start with the video's actual end time", () => {
    const { container } = renderReward();
    const video = container.querySelector("video")!;

    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 4.0 });
    act(() => {
      fireEvent.timeUpdate(video);
    });

    expect(video.className).toContain("animate-streak-reward-video-enter");

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(video.className).toContain("animate-streak-reward-video-exit");
  });
});
