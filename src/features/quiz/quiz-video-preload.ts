export const QUIZ_COUNT_SELECTION_FRAME_FPS = 30;
export const QUIZ_COUNT_SELECTION_FRAME_SOURCES = Array.from(
  { length: 61 },
  (_, index) =>
    `/quiz/count-selection-frames/frame-${String(index + 1).padStart(3, "0")}.webp?v=20261009-1`,
);

const preloadedFrameImages = new Map<string, HTMLImageElement>();
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
