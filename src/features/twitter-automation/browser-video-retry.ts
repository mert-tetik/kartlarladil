export const BROWSER_VIDEO_MAX_ATTEMPTS = 3;

const FIRST_BROWSER_VIDEO_TIMEOUT_MS = 2 * 60 * 1_000;
const BROWSER_VIDEO_TIMEOUT_STEP_MS = 60 * 1_000;
const BROWSER_VIDEO_RETRY_DELAYS_MS = [1_000, 3_000] as const;

export function browserVideoTimeoutMs(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.min(BROWSER_VIDEO_MAX_ATTEMPTS, Math.floor(attempt)));
  return FIRST_BROWSER_VIDEO_TIMEOUT_MS + (normalizedAttempt - 1) * BROWSER_VIDEO_TIMEOUT_STEP_MS;
}

export function shouldRetryBrowserVideo(attempt: number) {
  return attempt < BROWSER_VIDEO_MAX_ATTEMPTS;
}

export function browserVideoRetryDelayMs(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.min(BROWSER_VIDEO_MAX_ATTEMPTS - 1, Math.floor(attempt)));
  return BROWSER_VIDEO_RETRY_DELAYS_MS[normalizedAttempt - 1]!;
}

export function browserVideoFailureCode(error: unknown, fallback = "browser_video_render_failed") {
  const candidate = error instanceof Error ? error.message : "";
  return /^[a-z][a-z\d_]{2,119}$/u.test(candidate) ? candidate : fallback;
}

export function formatBrowserVideoTimeout(attempt: number) {
  return `${Math.round(browserVideoTimeoutMs(attempt) / 60_000)} dk`;
}
