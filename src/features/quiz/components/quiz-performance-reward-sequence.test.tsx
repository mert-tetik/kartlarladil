import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizPerformanceRewardSequence } from "@/features/quiz/components/quiz-performance-reward-sequence";
import { getScoreFlightAwardAtArrival, getScoreFlightIconCount } from "@/features/progress/reward-scatter";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

const mocks = vi.hoisted(() => ({
  award: vi.fn(),
  updateProfileField: vi.fn(),
  refreshProfile: vi.fn(async () => undefined),
  onPointsArrive: vi.fn(),
  onRewardsFinished: vi.fn(),
  onRankCheckComplete: vi.fn(),
  onAwardPersisted: vi.fn(async () => null),
  onAwardError: vi.fn(),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({
    user: { id: "user-1", profile: { quizResultPoints: 12 } },
    updateProfileField: mocks.updateProfileField,
    refreshProfile: mocks.refreshProfile,
  }),
}));

vi.mock("@/features/quiz/actions", () => ({
  awardQuizPerformancePoints: (...args: unknown[]) => mocks.award(...args),
}));

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

vi.mock("@/features/progress/components/main-points-display", () => ({
  MainPointsDisplay: ({ value, targetRef, pulse }: {
    value: string;
    targetRef?: Ref<HTMLSpanElement>;
    pulse?: number;
  }) => (
    <div data-main-points-display data-pulse={pulse}>
      <span ref={targetRef}>{value}</span>
    </div>
  ),
}));

vi.mock("@/features/progress/components/reward-gem-hud", () => ({
  RewardGemHud: () => <div data-reward-gem-hud />,
}));

vi.mock("@/features/progress/components/reward-scatter", () => ({
  RewardScatter: ({ points, onPointsStart, onPointsArrive, onPointsComplete, flightExit }: {
    points: {
      amount: number;
      startDelayMs?: number;
      arrivalSoundEffect?: string | false;
      vibrateOnArrival?: boolean;
    };
    onPointsStart?: () => void;
    onPointsArrive?: (amount: number, index: number) => void;
    onPointsComplete?: () => void;
    flightExit?: boolean;
  }) => (
    <div
      data-performance-scatter
      data-amount={points.amount}
      data-start-delay={points.startDelayMs}
      data-arrival-sound-effect={points.arrivalSoundEffect}
      data-vibrate-on-arrival={points.vibrateOnArrival ? "true" : "false"}
      data-flight-exit={flightExit ? "true" : "false"}
    >
      <button type="button" data-scatter-start onClick={onPointsStart}>start</button>
      <button type="button" data-scatter-arrive onClick={() => onPointsArrive?.(points.amount, 1)}>arrive</button>
      <button
        type="button"
        data-scatter-arrive-all
        onClick={() => {
          const iconCount = getScoreFlightIconCount(points.amount);
          for (let index = 1; index <= iconCount; index += 1) {
            onPointsArrive?.(getScoreFlightAwardAtArrival(points.amount, iconCount, index), index);
          }
        }}
      >
        arrive all
      </button>
      <button type="button" data-scatter-complete onClick={onPointsComplete}>complete</button>
    </div>
  ),
}));

describe("QuizPerformanceRewardSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.award.mockResolvedValue({
      success: true,
      awarded: true,
      rewards: { accuracyPoints: 20, timePoints: 0, correctPoints: 0, learnedPoints: 20 },
      totalPoints: 40,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for entrance, skips zero categories, and keeps persisted scoring in the background", async () => {
    vi.useFakeTimers();
    const onPointsArrive = mocks.onPointsArrive;
    const props = {
      sessionId: "00000000-0000-4000-8000-000000000051",
      input: {
        selectedCount: 10,
        durationSeconds: 600,
        correctAnswerCount: 4,
        answeredCount: 10,
        correctCardCount: 0,
        learnedCardCount: 1,
      },
      currentTotalPoints: 180,
      entered: false,
      exiting: false,
      onPointsArrive,
      onRewardsFinished: mocks.onRewardsFinished,
      onRankCheckComplete: mocks.onRankCheckComplete,
      onAwardError: mocks.onAwardError,
      onAwardPersisted: mocks.onAwardPersisted,
    };
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <div data-result-stat="accuracy" />
        <div data-result-stat="time" />
        <div data-result-stat="correct" />
        <div data-result-stat="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} />
      </LocaleProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.award).toHaveBeenCalledWith(props.sessionId, props.input);
    expect(mocks.onAwardPersisted).toHaveBeenCalledOnce();
    expect(mocks.onRankCheckComplete).toHaveBeenCalledWith({
      fromRank: expect.objectContaining({ id: "baslangic" }),
      rank: expect.objectContaining({ id: "kart-ciragi" }),
    });
    expect(document.querySelectorAll("[data-performance-scatter]")).toHaveLength(0);

    rerender(
      <LocaleProvider initialLocale="en">
        <div data-result-stat="accuracy" />
        <div data-result-stat="time" />
        <div data-result-stat="correct" />
        <div data-result-stat="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} entered />
      </LocaleProvider>,
    );
    act(() => vi.advanceTimersByTime(199));
    expect(document.querySelectorAll("[data-performance-scatter]")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));

    const scatterGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-performance-scatter]"));
    expect(scatterGroups).toHaveLength(2);
    expect(scatterGroups.map((group) => group.dataset.startDelay)).toEqual(["0", "400"]);
    expect(scatterGroups.map((group) => group.dataset.arrivalSoundEffect)).toEqual(["points", "points"]);
    expect(scatterGroups.map((group) => group.dataset.vibrateOnArrival)).toEqual(["true", "true"]);

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-start]")!);
    expect(document.querySelector("[data-result-performance-reward-hud]")).toHaveClass("animate-streak-reward-hud-enter");
    expect(playSoundEffect).toHaveBeenCalledWith("quiz-result-point-award");
    expect(vibrate).toHaveBeenCalledWith("result");

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-arrive]")!);
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(onPointsArrive).toHaveBeenCalledWith(20);

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-complete]")!);
    fireEvent.click(scatterGroups[1].querySelector("[data-scatter-start]")!);
    fireEvent.click(scatterGroups[1].querySelector("[data-scatter-complete]")!);
    expect(document.querySelector("[data-result-performance-reward-hud]")).toHaveClass("animate-streak-reward-hud-exit");
    expect(mocks.onRewardsFinished).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(320));
    expect(document.querySelector("[data-result-performance-reward-hud]")).not.toBeInTheDocument();

    rerender(
      <LocaleProvider initialLocale="en">
        <div data-result-stat="accuracy" />
        <div data-result-stat="time" />
        <div data-result-stat="correct" />
        <div data-result-stat="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} entered exiting />
      </LocaleProvider>,
    );
    expect(document.querySelectorAll('[data-flight-exit="true"]')).toHaveLength(2);
  });

  it("counts cumulative scatter arrivals once across all four reward categories", async () => {
    vi.useFakeTimers();
    mocks.award.mockResolvedValue({
      success: true,
      awarded: true,
      rewards: { accuracyPoints: 50, timePoints: 50, correctPoints: 50, learnedPoints: 50 },
      totalPoints: 200,
    });
    const props = {
      sessionId: "00000000-0000-4000-8000-000000000052",
      input: {
        selectedCount: 10,
        durationSeconds: 0,
        correctAnswerCount: 10,
        answeredCount: 10,
        correctCardCount: 10,
        learnedCardCount: 10,
      },
      currentTotalPoints: 180,
      entered: false,
      exiting: false,
      onPointsArrive: mocks.onPointsArrive,
      onRewardsFinished: mocks.onRewardsFinished,
      onRankCheckComplete: mocks.onRankCheckComplete,
      onAwardError: mocks.onAwardError,
      onAwardPersisted: mocks.onAwardPersisted,
    };
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <div data-result-stat="accuracy" />
        <div data-result-stat="time" />
        <div data-result-card="correct" />
        <div data-result-card="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} />
      </LocaleProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    rerender(
      <LocaleProvider initialLocale="en">
        <div data-result-stat="accuracy" />
        <div data-result-stat="time" />
        <div data-result-card="correct" />
        <div data-result-card="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} entered />
      </LocaleProvider>,
    );
    act(() => vi.advanceTimersByTime(200));

    const scatterGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-performance-scatter]"));
    expect(scatterGroups).toHaveLength(4);
    for (const [index, group] of scatterGroups.entries()) {
      fireEvent.click(group.querySelector("[data-scatter-start]")!);
      fireEvent.click(group.querySelector("[data-scatter-arrive-all]")!);
      expect(document.querySelector("[data-main-points-display] span")).toHaveTextContent(
        String(180 + (index + 1) * 50),
      );
    }

    expect(mocks.onPointsArrive).toHaveBeenCalledTimes(100);
    expect(
      mocks.onPointsArrive.mock.calls.reduce((total, [amount]) => total + Number(amount), 0),
    ).toBe(200);
    expect(screen.getByText("380")).toBeInTheDocument();
  });
});
