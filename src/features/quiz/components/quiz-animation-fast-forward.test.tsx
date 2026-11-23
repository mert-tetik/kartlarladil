import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuizMedalRating } from "@/features/quiz/components/quiz-medal-rating";
import {
  finishCurrentWebAnimations,
  isQuizAnimationFastForwardDoubleTap,
  QUIZ_ANIMATION_FAST_FORWARD_DOUBLE_TAP_MS,
  QuizAnimationFastForwardProvider,
  useQuizAnimationFastForward,
  useQuizAnimationFastForwardRequest,
} from "@/features/quiz/components/quiz-animation-fast-forward";

const { playSoundEffectMock, vibrateMock } = vi.hoisted(() => ({
  playSoundEffectMock: vi.fn(),
  vibrateMock: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: playSoundEffectMock,
  preloadSoundEffects: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({ vibrate: vibrateMock }));

describe("quiz animation fast-forward", () => {
  it("requires two taps inside the double-tap window and resets after a successful pair", () => {
    const lastTapAtRef = { current: 0 };

    expect(isQuizAnimationFastForwardDoubleTap(lastTapAtRef, 1000)).toBe(false);
    expect(isQuizAnimationFastForwardDoubleTap(lastTapAtRef, 1000 + QUIZ_ANIMATION_FAST_FORWARD_DOUBLE_TAP_MS)).toBe(true);
    expect(lastTapAtRef.current).toBe(0);
    expect(isQuizAnimationFastForwardDoubleTap(lastTapAtRef, 2000)).toBe(false);
    expect(isQuizAnimationFastForwardDoubleTap(lastTapAtRef, 2000 + QUIZ_ANIMATION_FAST_FORWARD_DOUBLE_TAP_MS + 1)).toBe(false);
  });

  it("finishes only finite animations that have already started", () => {
    const root = document.createElement("div");
    const activeAnimation = createAnimation({ currentTime: 40, delay: 0, endTime: 100 });
    const delayedAnimation = createAnimation({ currentTime: 40, delay: 60, endTime: 160 });
    const infiniteAnimation = createAnimation({ currentTime: 40, delay: 0, endTime: Number.POSITIVE_INFINITY });
    Object.defineProperty(root, "getAnimations", {
      value: vi.fn(() => [activeAnimation, delayedAnimation, infiniteAnimation]),
    });

    expect(finishCurrentWebAnimations(root)).toBe(1);
    expect(activeAnimation.finish).toHaveBeenCalledOnce();
    expect(delayedAnimation.finish).not.toHaveBeenCalled();
    expect(infiniteAnimation.finish).not.toHaveBeenCalled();
  });

  it("vibrates when a generic active animation is fast-forwarded", () => {
    vi.clearAllMocks();
    const activeAnimation = createAnimation({ currentTime: 40, delay: 0, endTime: 100 });

    function GenericAnimatedSurface() {
      const rootRef = useRef<HTMLDivElement>(null);
      const requestFastForward = useQuizAnimationFastForwardRequest();

      return (
        <div
          ref={rootRef}
          data-testid="generic-animation-surface"
          onClick={() => {
            if (rootRef.current) requestFastForward?.(rootRef.current);
          }}
        />
      );
    }

    const { getByTestId } = render(
      <QuizAnimationFastForwardProvider>
        <GenericAnimatedSurface />
      </QuizAnimationFastForwardProvider>,
    );
    Object.defineProperty(getByTestId("generic-animation-surface"), "getAnimations", {
      value: () => [activeAnimation],
    });

    act(() => fireEvent.click(getByTestId("generic-animation-surface")));

    expect(activeAnimation.finish).toHaveBeenCalledOnce();
    expect(vibrateMock).toHaveBeenCalledExactlyOnceWith("quiz-animation-fast-forward");
  });

  it("runs every active handler at the winning priority before lower-priority handlers", () => {
    vi.clearAllMocks();
    const order: string[] = [];

    function RegisteredScreen() {
      const rootRef = useRef<HTMLDivElement>(null);
      const requestFastForward = useQuizAnimationFastForwardRequest();
      useQuizAnimationFastForward(() => {
        order.push("lower");
        return true;
      }, true, 10);
      useQuizAnimationFastForward(() => {
        order.push("screen");
        return true;
      }, true, 100);
      useQuizAnimationFastForward(() => {
        order.push("peer-screen");
        return true;
      }, true, 100);

      return (
        <div ref={rootRef}>
          <button type="button" onClick={() => {
            if (rootRef.current) requestFastForward?.(rootRef.current);
          }}>
            Fast-forward
          </button>
        </div>
      );
    }

    const { getByRole } = render(
      <QuizAnimationFastForwardProvider>
        <RegisteredScreen />
      </QuizAnimationFastForwardProvider>,
    );

    act(() => fireEvent.click(getByRole("button", { name: "Fast-forward" })));

    expect(order).toEqual(["screen", "peer-screen"]);
    expect(vibrateMock).toHaveBeenCalledExactlyOnceWith("quiz-animation-fast-forward");
  });

  it("reveals every quiz medal on one fast-forward tap and plays one reveal sound", () => {
    vi.clearAllMocks();
    const onRevealComplete = vi.fn();

    function MedalRevealTapTarget() {
      const rootRef = useRef<HTMLDivElement>(null);
      const requestFastForward = useQuizAnimationFastForwardRequest();

      return (
        <div
          ref={rootRef}
          data-testid="medal-reveal-surface"
          onClick={() => {
            if (rootRef.current) requestFastForward?.(rootRef.current);
          }}
        >
          <QuizMedalRating rating={3} sequentialReveal onRevealComplete={onRevealComplete} />
        </div>
      );
    }

    const { getByTestId, container } = render(
      <QuizAnimationFastForwardProvider>
        <MedalRevealTapTarget />
      </QuizAnimationFastForwardProvider>,
    );

    act(() => fireEvent.click(getByTestId("medal-reveal-surface")));

    const filledMedals = container.querySelectorAll('[data-quiz-medal="filled"]');
    const emptyMedals = container.querySelectorAll('[data-quiz-medal="empty"]');
    expect(filledMedals).toHaveLength(3);
    expect(emptyMedals).toHaveLength(2);
    filledMedals.forEach((medal) => expect(medal).toHaveClass("opacity-100"));
    emptyMedals.forEach((medal) => expect(medal).toHaveClass("opacity-100"));
    expect(playSoundEffectMock).toHaveBeenCalledExactlyOnceWith("quiz-medal-reveal");
    expect(vibrateMock).toHaveBeenCalledExactlyOnceWith("quiz-animation-fast-forward");
    expect(onRevealComplete).toHaveBeenCalledOnce();

    act(() => fireEvent.click(getByTestId("medal-reveal-surface")));
    expect(playSoundEffectMock).toHaveBeenCalledExactlyOnceWith("quiz-medal-reveal");
    expect(vibrateMock).toHaveBeenCalledExactlyOnceWith("quiz-animation-fast-forward");
    expect(onRevealComplete).toHaveBeenCalledOnce();
  });
});

function createAnimation({
  currentTime,
  delay,
  endTime,
}: {
  currentTime: number;
  delay: number;
  endTime: number;
}): Animation {
  return {
    currentTime,
    playState: "running",
    effect: {
      getTiming: () => ({ delay }),
      getComputedTiming: () => ({ endTime }),
    } as KeyframeEffect,
    finish: vi.fn(),
  } as unknown as Animation;
}
