export const BROWSER_VIDEO_MAX_ATTEMPTS = 3;

export const BROWSER_VIDEO_PLAN_TIMEOUT_MS = 10 * 60 * 1_000;
export const BROWSER_VIDEO_RENDER_STALL_TIMEOUT_MS = 5 * 60 * 1_000;
const BROWSER_VIDEO_RETRY_DELAYS_MS = [1_000, 3_000] as const;

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

export function shouldRetryBrowserVideoFailure(errorCode: string) {
  return errorCode.endsWith("_timeout")
    || errorCode.endsWith("_failed")
    || errorCode.endsWith("_unavailable")
    || errorCode === "recording_failed"
    || errorCode === "automation_processing_failed";
}
