import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import {
  QuizAnimationFastForwardProvider,
  useQuizAnimationFastForwardRequest,
} from "@/features/quiz/components/quiz-animation-fast-forward";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

const source = { left: 20, top: 80, width: 120, height: 80 };
const target = { left: 250, top: 16, width: 48, height: 48 };

function FastForwardTrigger() {
  const fastForward = useQuizAnimationFastForwardRequest();
  return (
    <button type="button" onClick={() => fastForward?.(document.body)}>
      Fast-forward
    </button>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("RewardScatter fast-forward", () => {
  it("sends every remaining point and gem particle to the displays together before awarding them", () => {
    const onPointsArrive = vi.fn();
    const onPointsComplete = vi.fn();
    const onGemArrive = vi.fn();
    const onGemsComplete = vi.fn();
    const points = { amount: 10, source, target, iconCount: 5, flightStaggerMs: 200 };
    const gemTargetRectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute("data-reward-flight-id")) {
          return { left: 100, top: 150, width: 24, height: 24 } as DOMRect;
        }
        return this.getAttribute("data-reward-gem-target") === "blue"
          ? target as DOMRect
          : { left: 0, top: 0, width: 0, height: 0 } as DOMRect;
      });
    const animationDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    const animations: Animation[] = [];
    const animatedElements: HTMLElement[] = [];
    const animateMock = vi.fn<Element["animate"]>(function (this: Element) {
      const animation = { cancel: vi.fn(), onfinish: null } as unknown as Animation;
      animations.push(animation);
      animatedElements.push(this as HTMLElement);
      return animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    try {
      const { rerender } = render(
        <>
          <div data-reward-gem-hud-role="main">
            <span data-reward-gem-target="blue" />
          </div>
          <RewardScatter
            points={points}
            gems={{ rewards: [{ type: "blue", amount: 3 }], source }}
            fastForwardSignal={0}
            onPointsArrive={onPointsArrive}
            onPointsComplete={onPointsComplete}
            onGemArrive={onGemArrive}
            onGemsComplete={onGemsComplete}
          />
        </>,
      );

      const flights = Array.from(
        document.querySelectorAll<HTMLElement>("[data-reward-flight-id]"),
      );
      expect(flights).toHaveLength(8);
      expect(new Set(
        flights
          .filter((flight) => flight.dataset.rewardFlightChannel === "points")
          .map((flight) => flight.style.animationDelay),
      ).size).toBeGreaterThan(1);

      rerender(
        <>
          <div data-reward-gem-hud-role="main">
            <span data-reward-gem-target="blue" />
          </div>
          <RewardScatter
            points={points}
            gems={{ rewards: [{ type: "blue", amount: 3 }], source }}
            fastForwardSignal={1}
            onPointsArrive={onPointsArrive}
            onPointsComplete={onPointsComplete}
            onGemArrive={onGemArrive}
            onGemsComplete={onGemsComplete}
          />
        </>,
      );

      expect(animateMock).toHaveBeenCalledTimes(8);
      expect(animateMock.mock.calls.every(([, options]) =>
        typeof options === "object" && options !== null && options.duration === 400,
      )).toBe(true);
      for (const [index, element] of animatedElements.entries()) {
        const keyframes = animateMock.mock.calls[index]?.[0] as Keyframe[];
        const iconSize = element.dataset.rewardFlightChannel === "points" ? 30 : 40;
        const layoutWidth = (element as HTMLElement).offsetWidth || iconSize;
        const layoutHeight = (element as HTMLElement).offsetHeight || iconSize;
        expect(keyframes[0]?.transform).toContain("translate3d(100px, 150px, 0)");
        const destination = String(keyframes[1]?.transform).match(
          /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) scale\(0\.5\)/,
        );
        expect(destination).not.toBeNull();
        expect(Math.abs(274 - (Number(destination?.[1]) + layoutWidth * 0.25))).toBeLessThanOrEqual(1);
        expect(Math.abs(40 - (Number(destination?.[2]) + layoutHeight * 0.25))).toBeLessThanOrEqual(1);
        expect((element as HTMLElement).style.transformOrigin).toBe("top left");
      }
      expect(animatedElements.every((element) =>
        element.dataset.rewardScatterInstanceId === flights[0].dataset.rewardScatterInstanceId,
      )).toBe(true);
      expect(onPointsArrive).not.toHaveBeenCalled();

      act(() => {
        for (const animation of animations) {
          animation.onfinish?.call(animation, new Event("finish") as AnimationPlaybackEvent);
        }
      });

      expect(onPointsArrive).toHaveBeenCalledTimes(5);
      expect(onPointsArrive.mock.calls.map(([amount]) => amount)).toEqual([2, 4, 6, 8, 10]);
      expect(onPointsComplete).toHaveBeenCalledOnce();
      expect(onGemArrive).toHaveBeenCalledTimes(3);
      expect(onGemArrive.mock.calls.reduce((total, [, amount]) => total + amount, 0)).toBe(3);
      expect(onGemsComplete).toHaveBeenCalledOnce();
    } finally {
      gemTargetRectSpy.mockRestore();
      if (animationDescriptor) {
        Object.defineProperty(Element.prototype, "animate", animationDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "animate");
      }
    }
  });

  it("scopes the fast-forward to its own scatter instance when flight IDs overlap", async () => {
    const points = { amount: 2, source, target, iconCount: 1 };
    const animationDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    const animatedElements: HTMLElement[] = [];
    const animateMock = vi.fn<Element["animate"]>(function (this: Element) {
      animatedElements.push(this as HTMLElement);
      return { cancel: vi.fn(), onfinish: null } as unknown as Animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    try {
      const { rerender } = render(
        <>
          <RewardScatter points={points} fastForwardSignal={0} />
          <RewardScatter points={points} fastForwardSignal={0} />
        </>,
      );

      await waitFor(() => {
        expect(document.querySelectorAll('[data-reward-flight-id="points-0"]')).toHaveLength(2);
      });
      const flights = Array.from(
        document.querySelectorAll<HTMLElement>('[data-reward-flight-id="points-0"]'),
      );
      const [firstInstanceId, secondInstanceId] = flights.map(
        (flight) => flight.dataset.rewardScatterInstanceId,
      );
      expect(firstInstanceId).not.toBe(secondInstanceId);

      rerender(
        <>
          <RewardScatter points={points} fastForwardSignal={1} />
          <RewardScatter points={points} fastForwardSignal={0} />
        </>,
      );

      expect(animateMock).toHaveBeenCalledOnce();
      expect(animatedElements[0].dataset.rewardScatterInstanceId).toBe(firstInstanceId);
      expect(animatedElements[0].dataset.rewardScatterInstanceId).not.toBe(secondInstanceId);
    } finally {
      if (animationDescriptor) {
        Object.defineProperty(Element.prototype, "animate", animationDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "animate");
      }
    }
  });

  it("runs the 400 ms flight through the shared quiz fast-forward provider", async () => {
    const animationDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    const animations: Animation[] = [];
    const animateMock = vi.fn<Element["animate"]>(function () {
      const animation = { cancel: vi.fn(), onfinish: null } as unknown as Animation;
      animations.push(animation);
      return animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      writable: true,
      value: animateMock,
    });

    try {
      const onPointsArrive = vi.fn();
      render(
        <QuizAnimationFastForwardProvider>
          <FastForwardTrigger />
          <RewardScatter
            points={{ amount: 12, source, target, iconCount: 6, flightStaggerMs: 180 }}
            onPointsArrive={onPointsArrive}
          />
        </QuizAnimationFastForwardProvider>,
      );

      await waitFor(() => {
        expect(document.querySelectorAll('[data-reward-flight-channel="points"]')).toHaveLength(6);
      });
      fireEvent.click(document.querySelector("button")!);

      expect(animateMock).toHaveBeenCalledTimes(6);
      expect(animateMock.mock.calls.every(([, options]) =>
        typeof options === "object" && options !== null && options.duration === 400,
      )).toBe(true);
      expect(onPointsArrive).not.toHaveBeenCalled();

      act(() => {
        for (const animation of animations) {
          animation.onfinish?.call(animation, new Event("finish") as AnimationPlaybackEvent);
        }
      });

      expect(onPointsArrive).toHaveBeenCalledTimes(6);
    } finally {
      if (animationDescriptor) {
        Object.defineProperty(Element.prototype, "animate", animationDescriptor);
      } else {
        Reflect.deleteProperty(Element.prototype, "animate");
      }
    }
  });
});
