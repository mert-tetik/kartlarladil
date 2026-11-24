export const SERIOUS_LEARNER_FRAME_COUNT = 50;
export const SERIOUS_LEARNER_FRAME_BASE_PATH = "/pricing-subscription-menu-frames-v2";
export const SERIOUS_LEARNER_HERO_PATH = "/subscriptions/serious-learner-basic-v2.webp";

let seriousLearnerPreloadPromise: Promise<void> | null = null;

function waitForImage(source: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    const finish = () => {
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = source;
    if (image.complete) finish();
  });
}

/** Fire-and-forget warmup; callers must never gate onboarding or Continue on it. */
export function preloadSeriousLearnerAssets() {
  if (typeof window === "undefined") return Promise.resolve();
  if (seriousLearnerPreloadPromise) return seriousLearnerPreloadPromise;

  const sources = [
    SERIOUS_LEARNER_HERO_PATH,
    ...Array.from(
      { length: SERIOUS_LEARNER_FRAME_COUNT },
      (_, index) => `${SERIOUS_LEARNER_FRAME_BASE_PATH}/${index + 1}.webp`,
    ),
  ];

  // These independent static assets should warm together during login or
  // onboarding; serial loading can leave most of the animation cold when the
  // offer screen appears. Callers intentionally do not await this promise.
  seriousLearnerPreloadPromise = Promise.all(sources.map(waitForImage)).then(() => undefined);

  return seriousLearnerPreloadPromise;
}
