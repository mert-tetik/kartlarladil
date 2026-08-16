export const BROWSER_VIDEO_MAX_ATTEMPTS = 3;

const FIRST_BROWSER_VIDEO_TIMEOUT_MS = 2 * 60 * 1_000;
const BROWSER_VIDEO_TIMEOUT_STEP_MS = 60 * 1_000;

export function browserVideoTimeoutMs(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.min(BROWSER_VIDEO_MAX_ATTEMPTS, Math.floor(attempt)));
  return FIRST_BROWSER_VIDEO_TIMEOUT_MS + (normalizedAttempt - 1) * BROWSER_VIDEO_TIMEOUT_STEP_MS;
}

export function shouldRetryBrowserVideo(attempt: number) {
  return attempt < BROWSER_VIDEO_MAX_ATTEMPTS;
}

export function formatBrowserVideoTimeout(attempt: number) {
  return `${Math.round(browserVideoTimeoutMs(attempt) / 60_000)} dk`;
}
