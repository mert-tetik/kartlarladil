export const QUIZ_COUNT_SELECTION_VIDEO_SOURCE =
  "/quiz/kac-kartla-calisacaksin.mp4?v=20261008-1";

const preloadedVideos = new Map<string, HTMLVideoElement>();
const readySources = new Set<string>();
const readyListeners = new Map<string, Set<() => void>>();

function markVideoReady(source: string, video: HTMLVideoElement) {
  if (readySources.has(source)) return;

  readySources.add(source);
  try {
    video.pause();
    video.currentTime = 0;
  } catch {
    // Some test/WebView media implementations expose the events but reject
    // pause or seeking until the element is fully attached.
  }

  const listeners = readyListeners.get(source);
  listeners?.forEach((listener) => listener());
  listeners?.clear();
}

export function preloadQuizVideo(source: string) {
  if (typeof document === "undefined") return;

  const existingVideo = preloadedVideos.get(source);
  if (existingVideo) return;

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.tabIndex = -1;
  video.style.position = "fixed";
  video.style.left = "-2px";
  video.style.top = "-2px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  const handleReady = () => markVideoReady(source, video);
  video.addEventListener("loadeddata", handleReady);
  video.addEventListener("canplay", handleReady);
  video.src = source;
  document.body.appendChild(video);
  preloadedVideos.set(source, video);
  video.load();

  // Muted autoplay makes the browser decode the first frame instead of only
  // fetching metadata. The video is paused again as soon as that frame is ready.
  try {
    void video.play().catch(() => undefined);
  } catch {
    // Loading the resource is still useful when autoplay is unavailable.
  }
}

export function isQuizVideoReady(source: string) {
  return readySources.has(source);
}

export function subscribeToQuizVideoReady(source: string, listener: () => void) {
  if (readySources.has(source)) {
    listener();
    return () => undefined;
  }

  const listeners = readyListeners.get(source) ?? new Set<() => void>();
  listeners.add(listener);
  readyListeners.set(source, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) readyListeners.delete(source);
  };
}

export function preloadQuizCountSelectionVideo() {
  preloadQuizVideo(QUIZ_COUNT_SELECTION_VIDEO_SOURCE);
}
