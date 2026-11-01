export const QUIZ_COUNT_SELECTION_FRAME_FPS = 30;
export const QUIZ_COUNT_SELECTION_FRAME_SOURCES = Array.from(
  { length: 61 },
  (_, index) =>
    `/quiz/count-selection-frames/frame-${String(index + 1).padStart(3, "0")}.webp?v=20261009-1`,
);

const QUIZ_CRITICAL_IMAGE_SOURCES = [
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
  "/quiz/quiz-word-repetition-teacher.png?v=20261008-2",
  "/quiz/quiz-word-repetition-teacher-1.png?v=20261008-1",
  "/chests/count-preview/wood.webp",
  "/chests/count-preview/iron.webp",
  "/chests/count-preview/gold.webp",
  "/chests/count-preview/diamond.webp",
  "/chests/count-preview/emerald.webp",
  "/chests/count-preview/ruby.webp",
] as const;

const preloadedFrameImages = new Map<string, HTMLImageElement>();
const preloadedCriticalImages = new Map<string, HTMLImageElement>();
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

export function preloadQuizCriticalMedia() {
  if (typeof window === "undefined") return;

  for (const source of QUIZ_CRITICAL_IMAGE_SOURCES) {
    preloadCriticalImage(source);
  }

  preloadQuizCountSelectionFrames();
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
