import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS,
  SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
  SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS,
  SERIOUS_LEARNER_EXIT_EASING,
  SERIOUS_LEARNER_EXIT_ANIMATION_MS,
  SERIOUS_LEARNER_EXIT_ITEM_COUNT,
  SERIOUS_LEARNER_EXIT_ITEM_DURATION_MS,
  SERIOUS_LEARNER_EXIT_STAGGER_MS,
  startSeriousLearnerExitAnimations,
} from "@/features/auth/serious-learner-animation";

const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
const originalGetAnimationsDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations");

afterEach(() => {
  vi.restoreAllMocks();

  if (originalAnimateDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimateDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }

  if (originalGetAnimationsDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", originalGetAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  }
});

describe("serious learner exit animation", () => {
  it("starts each UI scale-out in order, then moves the circle and background offscreen", () => {
    expect(SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS).toBe(650);
    expect(SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS).toBe(
      SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS + 200,
    );
    expect(SERIOUS_LEARNER_EXIT_ANIMATION_MS).toBe(
      SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS + SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
    );

    const animation = { cancel: vi.fn(), finished: Promise.resolve() } as unknown as Animation;
    const animate = vi.fn((..._args: Parameters<HTMLElement["animate"]>) => animation);
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });

    const root = document.createElement("div");
    for (let index = 0; index < SERIOUS_LEARNER_EXIT_ITEM_COUNT; index += 1) {
      const item = document.createElement("div");
      item.dataset.seriousLearnerExitItem = "";
      if (index === 0) item.style.visibility = "hidden";
      root.append(item);
    }
    const circle = document.createElement("div");
    circle.className = "serious-learner-offer-circle";
    circle.style.transform = "translate3d(-50%, -73%, 0)";
    root.append(circle);
    const background = document.createElement("div");
    background.dataset.subscriptionDetailsFrameLayer = "";
    root.append(background);

    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudoElement) => {
      if (element instanceof HTMLElement && element.hasAttribute("data-serious-learner-exit-item")) {
        return { transform: "matrix(0, 0, 0, 0, 0, 0)" } as unknown as CSSStyleDeclaration;
      }

      return nativeGetComputedStyle(element, pseudoElement);
    });

    const animations = startSeriousLearnerExitAnimations(root);

    expect(animations).toHaveLength(SERIOUS_LEARNER_EXIT_ITEM_COUNT + 2);
    expect(root).toHaveAttribute("data-serious-learner-waapi", "true");
    expect(root.querySelector<HTMLElement>("[data-serious-learner-exit-item]")?.style.visibility).toBe("visible");
    expect(root.querySelector<HTMLElement>("[data-serious-learner-exit-item]")?.style.transform).toBe("");

    const firstItemOptions = animate.mock.calls[0]?.[1] as unknown as KeyframeAnimationOptions;
    const lastItemOptions = animate.mock.calls[SERIOUS_LEARNER_EXIT_ITEM_COUNT - 1]?.[1] as unknown as KeyframeAnimationOptions;
    expect(firstItemOptions).toMatchObject({
      duration: SERIOUS_LEARNER_EXIT_ITEM_DURATION_MS,
      delay: 0,
      easing: SERIOUS_LEARNER_EXIT_EASING,
      fill: "both",
    });
    expect(lastItemOptions.delay).toBe((SERIOUS_LEARNER_EXIT_ITEM_COUNT - 1) * SERIOUS_LEARNER_EXIT_STAGGER_MS);
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { scale: "1" },
      { scale: "0" },
    ]);

    const circleOptions = animate.mock.calls[SERIOUS_LEARNER_EXIT_ITEM_COUNT]?.[1] as unknown as KeyframeAnimationOptions;
    const backgroundOptions = animate.mock.calls[SERIOUS_LEARNER_EXIT_ITEM_COUNT + 1]?.[1] as unknown as KeyframeAnimationOptions;
    const circleStartTransform = window.getComputedStyle(circle).transform;
    expect(circleOptions).toMatchObject({
      duration: SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
      delay: SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS,
      easing: SERIOUS_LEARNER_EXIT_EASING,
    });
    expect(backgroundOptions).toMatchObject({
      duration: SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
      delay: SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS,
      easing: SERIOUS_LEARNER_EXIT_EASING,
    });
    expect(animate.mock.calls[SERIOUS_LEARNER_EXIT_ITEM_COUNT]?.[0]).toEqual([
      { transform: circleStartTransform },
      { transform: "translate3d(-50%, -110%, 0)" },
    ]);
    expect(animate.mock.calls[SERIOUS_LEARNER_EXIT_ITEM_COUNT + 1]?.[0]).toEqual([
      { transform: "translate3d(0, 0, 0)" },
      { transform: "translate3d(0, 110vh, 0)" },
    ]);
    getComputedStyleSpy.mockRestore();
  });
});
