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

  seriousLearnerPreloadPromise = (async () => {
    await waitForImage(SERIOUS_LEARNER_HERO_PATH);
    for (let frame = 1; frame <= SERIOUS_LEARNER_FRAME_COUNT; frame += 1) {
      await waitForImage(`${SERIOUS_LEARNER_FRAME_BASE_PATH}/${frame}.webp`);
    }
  })();

  return seriousLearnerPreloadPromise;
}
