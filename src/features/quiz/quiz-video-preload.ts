export const QUIZ_COUNT_SELECTION_FRAME_FPS = 30;
export const QUIZ_COUNT_SELECTION_FRAME_SOURCES = Array.from(
  { length: 61 },
  (_, index) =>
    `/quiz/count-selection-frames/frame-${String(index + 1).padStart(3, "0")}.webp?v=20261009-1`,
);

export const QUIZ_PRESENTATION_SELECTION_ARTWORK = {
  easy: "/quiz/presentation-selection/easy-practice.webp",
  classic: [
    "/quiz/presentation-selection/classic-practice-01.webp",
    "/quiz/presentation-selection/classic-practice-02.webp",
    "/quiz/presentation-selection/classic-practice-03.webp",
    "/quiz/presentation-selection/classic-practice-04.webp",
    "/quiz/presentation-selection/classic-practice-05.webp",
    "/quiz/presentation-selection/classic-practice-06.webp",
  ],
} as const;

export const QUIZ_PRESENTATION_SELECTION_IMAGE_SOURCES = [
  QUIZ_PRESENTATION_SELECTION_ARTWORK.easy,
  ...QUIZ_PRESENTATION_SELECTION_ARTWORK.classic,
] as const;

const QUIZ_CRITICAL_IMAGE_SOURCES = [
  "/quiz/quiz-word-repetition-teacher.webp?v=20261008-2",
  "/quiz/quiz-word-repetition-teacher-1.webp?v=20261008-1",
  "/chests/count-preview/wood.webp",
  "/chests/count-preview/iron.webp",
  "/chests/count-preview/gold.webp",
  "/chests/count-preview/diamond.webp",
  "/chests/count-preview/emerald.webp",
  "/chests/count-preview/ruby.webp",
] as const;

// Keep this small URL-only list independent of the AI Practice data module so
// the app-shell preloader does not pull character prompts/localizations into
// the landing-page bundle.
const QUIZ_CHARACTER_IMAGE_SOURCES = [
  "/ai-characters/campus-friend.webp",
  "/ai-characters/friendly-worker.webp",
  "/ai-characters/gentle-companion.webp",
  "/ai-characters/gothic-calm.webp",
  "/ai-characters/skater-coach.webp",
  "/ai-characters/sleepy-student.webp",
  "/ai-characters/soft-artist.webp",
  "/ai-characters/study-buddy.webp",
  "/ai-characters/warm-grandmother.webp",
  "/ai-characters/wise-elder.webp",
] as const;
const preloadedFrameImages = new Map<string, HTMLImageElement>();
const preloadedCriticalImages = new Map<string, HTMLImageElement>();
const preloadedCharacterImages = new Map<string, HTMLImageElement>();
let quizCharacterImageLeaseCount = 0;
const frameLoadStates: Array<"idle" | "loading" | "loaded" | "failed"> =
  QUIZ_COUNT_SELECTION_FRAME_SOURCES.map(() => "idle");
let framesLoading = false;
let framesReady = false;
let framesSettled = false;

function loadFrame(source: string, index: number) {
  const existingImage = preloadedFrameImages.get(source);
  if (existingImage) {
    if (existingImage.complete && existingImage.naturalWidth > 0) {
      frameLoadStates[index] = "loaded";
      return Promise.resolve();
    }

    if (frameLoadStates[index] === "loading") {
      return new Promise<void>((resolve, reject) => {
        existingImage.addEventListener("load", () => resolve(), { once: true });
        existingImage.addEventListener(
          "error",
          () => reject(new Error(`Frame failed to load: ${source}`)),
          { once: true },
        );
      });
    }

    preloadedFrameImages.delete(source);
  }

  frameLoadStates[index] = "loading";
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = index === 0 ? "high" : index < 5 ? "auto" : "low";
  preloadedFrameImages.set(source, image);

  return new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => {
      frameLoadStates[index] = "loaded";
      resolve();
    }, { once: true });
    image.addEventListener(
      "error",
      () => {
        frameLoadStates[index] = "failed";
        preloadedFrameImages.delete(source);
        reject(new Error(`Frame failed to load: ${source}`));
      },
      { once: true },
    );
    image.src = source;
  });
}

function preloadCriticalImage(source: string) {
  if (typeof window === "undefined" || preloadedCriticalImages.has(source)) return;

  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = source;
  preloadedCriticalImages.set(source, image);
  void image.decode?.().catch(() => undefined);
}

/** Start fetching and decoding images known to be needed later in this Learn run. */
export function preloadQuizImageSources(sources: readonly string[]) {
  if (typeof window === "undefined") return;

  for (const source of sources) {
    if (preloadedCharacterImages.has(source)) continue;

    const image = new window.Image();
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "auto";
    preloadedCharacterImages.set(source, image);
    image.src = source;

    if (typeof image.decode === "function") {
      void image.decode().catch(() => {
        if (preloadedCharacterImages.get(source) === image) {
          preloadedCharacterImages.delete(source);
        }
      });
    }
  }
}

/** Keep all reusable AI Practice portraits decoded while Learn remains mounted. */
export function preloadQuizCharacterImages() {
  if (typeof window === "undefined") return () => undefined;

  quizCharacterImageLeaseCount += 1;
  preloadQuizImageSources(QUIZ_CHARACTER_IMAGE_SOURCES);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    quizCharacterImageLeaseCount = Math.max(0, quizCharacterImageLeaseCount - 1);

    if (quizCharacterImageLeaseCount === 0) {
      preloadedCharacterImages.clear();
    }
  };
}

export function preloadQuizCriticalMedia() {
  if (typeof window === "undefined") return;

  for (const source of QUIZ_CRITICAL_IMAGE_SOURCES) {
    preloadCriticalImage(source);
  }

  preloadQuizPresentationSelectionImages();
  preloadQuizCountSelectionFrames();
}

/** Fetch and decode both mode illustrations and every random classic variant. */
export function preloadQuizPresentationSelectionImages() {
  if (typeof window === "undefined") return;

  for (const source of QUIZ_PRESENTATION_SELECTION_IMAGE_SOURCES) {
    preloadCriticalImage(source);
  }
}

export function preloadQuizCountSelectionFrames() {
  if (typeof window === "undefined" || framesLoading || framesReady) return;

  framesLoading = true;
  framesSettled = false;
  void Promise.allSettled(
    QUIZ_COUNT_SELECTION_FRAME_SOURCES.map((source, index) => loadFrame(source, index)),
  ).then((results) => {
    framesSettled = true;
    framesLoading = false;
    framesReady = results.every((result) => result.status === "fulfilled");
  });
}

export function areQuizCountSelectionFramesReady() {
  return framesReady;
}

export function areQuizCountSelectionFramesSettled() {
  return framesSettled;
}

export function isQuizCountSelectionFrameLoaded(index: number) {
  return frameLoadStates[index] === "loaded";
}

export function getNextLoadedQuizCountSelectionFrameIndex(currentIndex: number) {
  for (let index = currentIndex + 1; index < frameLoadStates.length; index += 1) {
    const state = frameLoadStates[index];

    if (state === "loaded") return index;
    if (state === "idle" || state === "loading") return currentIndex;
  }

  if (!framesSettled) return currentIndex;

  return frameLoadStates.findIndex((state) => state === "loaded");
}

/*
 * Keep the first frame independently usable: the count screen should render as
 * soon as its poster arrives, while the remaining frames continue loading.
 */
export function areQuizCountSelectionFramesFirstFrameReady() {
  return isQuizCountSelectionFrameLoaded(0);
}
