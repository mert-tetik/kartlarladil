import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizPerformanceRewardSequence } from "@/features/quiz/components/quiz-performance-reward-sequence";
import { getScoreFlightAwardAtArrival, getScoreFlightIconCount } from "@/features/progress/reward-scatter";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

const playSoundEffectMock = vi.mocked(playSoundEffect);

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
      flightStaggerMs?: number;
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
      data-flight-stagger={points.flightStaggerMs}
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
        <div data-result-card="correct" />
        <div data-result-card="learned" />
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
        <div data-result-card="correct" />
        <div data-result-card="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} entered />
      </LocaleProvider>,
    );
    act(() => vi.advanceTimersByTime(199));
    expect(document.querySelectorAll("[data-performance-scatter]")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));

    const scatterGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-performance-scatter]"));
    expect(scatterGroups).toHaveLength(2);
    expect(scatterGroups.map((group) => group.dataset.startDelay)).toEqual(["0", "700"]);
    expect(scatterGroups.map((group) => group.dataset.flightStagger)).toEqual(["1600", "1600"]);
    expect(scatterGroups.map((group) => group.dataset.arrivalSoundEffect)).toEqual(["points", "points"]);
    expect(scatterGroups.map((group) => group.dataset.vibrateOnArrival)).toEqual(["true", "true"]);

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-start]")!);
    expect(document.querySelector("[data-result-performance-reward-hud]")).toHaveClass("animate-streak-reward-hud-enter");
    expect(playSoundEffect).toHaveBeenNthCalledWith(1, "quiz-reward-box-pulse", { playbackRate: 1 });
    expect(vibrate).toHaveBeenNthCalledWith(1, "quiz-reward-pulse");

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-arrive]")!);
    expect(playSoundEffectMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(onPointsArrive).toHaveBeenCalledWith(20);

    fireEvent.click(scatterGroups[0].querySelector("[data-scatter-complete]")!);
    fireEvent.click(scatterGroups[1].querySelector("[data-scatter-start]")!);
    expect(playSoundEffectMock.mock.calls[1]?.[0]).toBe("quiz-reward-box-pulse");
    expect(playSoundEffectMock.mock.calls[1]?.[1]?.playbackRate).toBeCloseTo(1.2);
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
        <div data-result-card="correct" />
        <div data-result-card="learned" />
        <div data-result-stat="points" />
        <QuizPerformanceRewardSequence {...props} entered exiting />
      </LocaleProvider>,
    );
    expect(document.querySelectorAll('[data-flight-exit="true"]')).toHaveLength(2);
  });

  it("runs the test-mode point scatter without writing a quiz award", async () => {
    vi.useFakeTimers();
    const props = {
      sessionId: null,
      input: {
        selectedCount: 10,
        durationSeconds: 0,
        correctAnswerCount: 10,
        answeredCount: 10,
        correctCardCount: 10,
        learnedCardCount: 3,
      },
      currentTotalPoints: 200,
      entered: true,
      exiting: false,
      onPointsArrive: mocks.onPointsArrive,
      onRewardsFinished: mocks.onRewardsFinished,
      onRankCheckComplete: mocks.onRankCheckComplete,
      onAwardError: mocks.onAwardError,
      onAwardPersisted: mocks.onAwardPersisted,
      testMode: true,
    };

    render(
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
    expect(mocks.award).not.toHaveBeenCalled();
    expect(mocks.onRankCheckComplete).toHaveBeenCalledExactlyOnceWith(null);

    act(() => vi.advanceTimersByTime(200));
    const scatterGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-performance-scatter]"));
    expect(scatterGroups).toHaveLength(4);
    for (const group of scatterGroups) {
      fireEvent.click(group.querySelector("[data-scatter-start]")!);
      fireEvent.click(group.querySelector("[data-scatter-arrive-all]")!);
    }

    expect(mocks.onPointsArrive.mock.calls.reduce((total, [amount]) => total + Number(amount), 0)).toBe(200);
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(playSoundEffect).toHaveBeenCalledWith("quiz-reward-box-pulse", expect.any(Object));
    expect(vibrate).toHaveBeenCalledWith("quiz-reward-pulse");
  });

  it("turns the pulsed stat border and foreground white and animates them back", async () => {
    vi.useFakeTimers();
    const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    const animateMock = vi.fn<Element["animate"]>(
      () => ({ cancel: vi.fn() }) as unknown as Animation,
    );
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    try {
      render(
        <LocaleProvider initialLocale="en">
          <div data-result-stat="accuracy" style={{ backgroundColor: "#333", border: "1px solid #666" }}>
            <span data-result-stat-label style={{ color: "#000", backgroundColor: "#00ff00" }}>
              Accuracy
            </span>
            <svg style={{ color: "#00f" }}>
              <path d="M0 0" style={{ fill: "#f00", stroke: "currentColor", strokeOpacity: 0.5 }} />
            </svg>
          </div>
          <div data-result-stat="time" />
          <div data-result-stat="points" />
          <QuizPerformanceRewardSequence
            sessionId={null}
            input={{
              selectedCount: 10,
              durationSeconds: 0,
              correctAnswerCount: 10,
              answeredCount: 10,
              correctCardCount: 0,
              learnedCardCount: 0,
            }}
            currentTotalPoints={0}
            entered
            exiting={false}
            onPointsArrive={mocks.onPointsArrive}
            testMode
          />
        </LocaleProvider>,
      );

      act(() => vi.advanceTimersByTime(200));
      const scatter = document.querySelector<HTMLElement>("[data-performance-scatter]");
      fireEvent.click(scatter!.querySelector("[data-scatter-start]")!);

      const statLabel = document.querySelector("[data-result-stat-label]");
      const statLabelAnimationIndex = animateMock.mock.contexts.findIndex((context) => context === statLabel);
      expect(statLabelAnimationIndex).toBeGreaterThanOrEqual(0);
      const statLabelKeyframes = animateMock.mock.calls[statLabelAnimationIndex]?.[0] as Keyframe[] | undefined;
      expect(Array.isArray(statLabelKeyframes)).toBe(true);
      expect(statLabelKeyframes).toContainEqual(expect.objectContaining({
        offset: 0.35,
        backgroundColor: "#fff",
      }));
      expect(statLabelKeyframes?.every((frame) => !("color" in frame))).toBe(true);
      const keyframes = animateMock.mock.calls.flatMap(([frames]) =>
        Array.isArray(frames) ? frames : [],
      );
      expect(keyframes).toContainEqual(expect.objectContaining({ color: "#fff" }));
      expect(keyframes).toContainEqual(expect.objectContaining({ transform: "scale(1.12)" }));
      const flashFrames = keyframes.filter((frame) => frame.offset === 0.35);
      expect(flashFrames.some((frame) =>
        frame.backgroundColor === "#fff" && frame.borderTopColor === "#fff",
      )).toBe(true);
      expect(flashFrames.some((frame) => frame.fill === "#fff" && frame.stroke === "#fff")).toBe(true);
      expect(flashFrames.some((frame) => frame.transform === "scale(1.12)")).toBe(true);
      const immediateWhiteFrames = keyframes.filter((frame) => frame.offset === 0);
      expect(immediateWhiteFrames.some((frame) => frame.color === "#fff")).toBe(false);
      expect(immediateWhiteFrames.some((frame) =>
        frame.fill === "rgb(255, 0, 0)" && frame.stroke === "rgb(0, 0, 255)"
          && frame.opacity === "1" && frame.fillOpacity === "1" && frame.strokeOpacity === "0.5",
      )).toBe(true);
      expect(flashFrames.some((frame) =>
        frame.fill === "#fff" && frame.stroke === "#fff" && frame.strokeOpacity === "1",
      )).toBe(true);
      const whiteHoldFrames = keyframes.filter((frame) => frame.offset === 0.45);
      expect(whiteHoldFrames.some((frame) =>
        frame.backgroundColor === "#fff" && frame.borderTopColor === "#fff",
      )).toBe(true);
      expect(whiteHoldFrames.some((frame) => frame.color === "#fff")).toBe(true);
      expect(whiteHoldFrames.some((frame) => frame.fill === "#fff" && frame.stroke === "#fff"))
        .toBe(true);
      expect(keyframes.some((frame) => frame.offset === 0.72 && frame.stroke === "rgb(0, 0, 255)"))
        .toBe(true);
      expect(immediateWhiteFrames.some((frame) => frame.transform === "scale(1)")).toBe(true);
      expect(animateMock.mock.calls.some(([, options]) =>
        typeof options === "object" && options !== null && options.duration === 620,
      )).toBe(true);
      const colorAndScalePulseOptions = animateMock.mock.calls
        .map(([, options]) => options)
        .filter((options): options is KeyframeAnimationOptions =>
          typeof options === "object" && options !== null && options.duration === 620,
        );
      expect(colorAndScalePulseOptions.length).toBeGreaterThan(1);
      expect(colorAndScalePulseOptions.every((options) => options.easing === "linear")).toBe(true);
      expect(keyframes.some((frame) =>
        frame.offset === 0 && frame.easing === "cubic-bezier(0.22, 1, 0.36, 1)",
      )).toBe(true);
      expect(keyframes.some((frame) =>
        frame.offset === 0.35 && frame.easing === "cubic-bezier(0.22, 1, 0.36, 1)",
      )).toBe(true);

      animateMock.mockClear();
      playSoundEffectMock.mockClear();
      fireEvent.click(scatter!.querySelector("[data-scatter-arrive]")!);
      const pointsBoxKeyframes = animateMock.mock.calls.flatMap(([frames]) =>
        Array.isArray(frames) ? frames : [],
      );
      expect(pointsBoxKeyframes).toContainEqual(expect.objectContaining({ transform: "scale(1.075)" }));
      expect(pointsBoxKeyframes).not.toContainEqual(expect.objectContaining({ color: "#fff" }));
      expect(pointsBoxKeyframes).not.toContainEqual(expect.objectContaining({ backgroundColor: "#fff" }));
      expect(playSoundEffectMock).not.toHaveBeenCalled();
    } finally {
      if (animateDescriptor) {
        Object.defineProperty(Element.prototype, "animate", animateDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "animate");
      }
      vi.useRealTimers();
    }
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
