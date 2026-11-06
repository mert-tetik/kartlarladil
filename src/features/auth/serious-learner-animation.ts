export const SERIOUS_LEARNER_EXIT_STAGGER_MS = 70;
export const SERIOUS_LEARNER_EXIT_ITEM_DURATION_MS = 320;
export const SERIOUS_LEARNER_EXIT_ITEM_COUNT = 11;
export const SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS = 650;
export const SERIOUS_LEARNER_EXIT_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";

export const SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS =
  (SERIOUS_LEARNER_EXIT_ITEM_COUNT - 1) * SERIOUS_LEARNER_EXIT_STAGGER_MS +
  SERIOUS_LEARNER_EXIT_ITEM_DURATION_MS;
export const SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS =
  SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS + 200;

export const SERIOUS_LEARNER_EXIT_ANIMATION_MS =
  SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS + SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS;

export const SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS = SERIOUS_LEARNER_EXIT_ANIMATION_MS + 50;

export function startSeriousLearnerExitAnimations(root: HTMLElement): Animation[] {
  const exitItems = Array.from(
    root.querySelectorAll<HTMLElement>("[data-serious-learner-exit-item]"),
  );
  const circle = root.querySelector<HTMLElement>(".serious-learner-offer-circle");
  const background = root.querySelector<HTMLElement>("[data-subscription-details-frame-layer]");
  const computedCircleTransform = circle ? window.getComputedStyle(circle).transform : null;
  const circleStartTransform = computedCircleTransform && computedCircleTransform !== "none"
    ? computedCircleTransform
    : "translate3d(-50%, -73%, 0)";
  const targets = [...exitItems, ...(circle ? [circle] : []), ...(background ? [background] : [])];

  if (targets.some((target) => typeof target.animate !== "function")) {
    return [];
  }

  const animations: Animation[] = [];
  root.dataset.seriousLearnerWaapi = "true";

  try {
    exitItems.forEach((item, order) => {
      item.getAnimations?.().forEach((animation) => animation.cancel());
      item.style.visibility = "visible";
      animations.push(item.animate(
        [
          { scale: "1" },
          { scale: "0" },
        ],
        {
          duration: SERIOUS_LEARNER_EXIT_ITEM_DURATION_MS,
          delay: order * SERIOUS_LEARNER_EXIT_STAGGER_MS,
          easing: SERIOUS_LEARNER_EXIT_EASING,
          fill: "both",
        },
      ));
    });

    if (circle) {
      animations.push(circle.animate(
        [
          { transform: circleStartTransform },
          { transform: "translate3d(-50%, -110%, 0)" },
        ],
        {
          duration: SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
          delay: SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS,
          easing: SERIOUS_LEARNER_EXIT_EASING,
          fill: "forwards",
        },
      ));
    }

    if (background) {
      animations.push(background.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          { transform: "translate3d(0, 110vh, 0)" },
        ],
        {
          duration: SERIOUS_LEARNER_BACKGROUND_EXIT_DURATION_MS,
          delay: SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS,
          easing: SERIOUS_LEARNER_EXIT_EASING,
          fill: "forwards",
        },
      ));
    }

    return animations;
  } catch {
    animations.forEach((animation) => animation.cancel());
    delete root.dataset.seriousLearnerWaapi;
    return [];
  }
}
