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
  "/quiz/count-options/10.png",
  "/quiz/count-options/20.png",
  "/quiz/count-options/30.png",
  "/quiz/count-options/50.png",
] as const;

const preloadedFrameImages = new Map<string, HTMLImageElement>();
const preloadedCriticalImages = new Map<string, HTMLImageElement>();
const frameReadyListeners = new Set<() => void>();
let framesLoading = false;
let framesReady = false;

function loadFrame(source: string) {
  const existingImage = preloadedFrameImages.get(source);
  if (existingImage) {
    if (existingImage.complete && existingImage.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      existingImage.addEventListener("load", () => resolve(), { once: true });
      existingImage.addEventListener(
        "error",
        () => {
          preloadedFrameImages.delete(source);
          reject(new Error(`Frame failed to load: ${source}`));
        },
        { once: true },
      );
    });
  }

  const image = new window.Image();
  image.decoding = "async";
  preloadedFrameImages.set(source, image);

  return new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener(
      "error",
      () => {
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
  void Promise.all(QUIZ_COUNT_SELECTION_FRAME_SOURCES.map((source) => loadFrame(source)))
    .then(() => {
      framesReady = true;
      frameReadyListeners.forEach((listener) => listener());
      frameReadyListeners.clear();
    })
    .catch(() => {
      framesLoading = false;
    });
}

export function areQuizCountSelectionFramesReady() {
  return framesReady;
}

export function subscribeToQuizCountSelectionFramesReady(listener: () => void) {
  if (framesReady) {
    listener();
    return () => undefined;
  }

  frameReadyListeners.add(listener);
  return () => {
    frameReadyListeners.delete(listener);
  };
}
