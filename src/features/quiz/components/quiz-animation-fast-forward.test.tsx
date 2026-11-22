import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  finishCurrentWebAnimations,
  QuizAnimationFastForwardProvider,
  useQuizAnimationFastForward,
  useQuizAnimationFastForwardRequest,
} from "@/features/quiz/components/quiz-animation-fast-forward";

describe("quiz animation fast-forward", () => {
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

  it("uses the highest-priority active screen handler before generic animations", () => {
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

    expect(order).toEqual(["screen"]);
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
