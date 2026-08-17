export const AUTOMATION_RETRY_DELAYS_MS = [30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000] as const;
export const MAX_AUTOMATION_RECOVERY_ATTEMPTS = AUTOMATION_RETRY_DELAYS_MS.length;
export const AUTOMATION_RENDERER_HEARTBEAT_MS = 15_000;
export const AUTOMATION_RENDERER_LEASE_MS = 10 * 60_000;
export const AUTOMATION_MIN_ACCOUNT_SCHEDULE_GAP_MS = 60 * 60_000;

export type AutomationErrorClass = "provider" | "storage" | "browser" | "network" | "quality" | "configuration" | "unknown";

export function classifyAutomationError(code: string) : AutomationErrorClass {
  const normalized = code.toLowerCase();
  if (/(?:invalid_|unsupported_|target_missing|caption_missing|not_configured|not_expected)/u.test(normalized)) return "configuration";
  if (/(?:poyo|openai|provider|upstream|rate|429|5\d\d|timeout|speech_timeout)/u.test(normalized)) return "provider";
  if (/(?:storage|store|stage|media_(?:read|url|cleanup)|upload)/u.test(normalized)) return "storage";
  if (/(?:browser|snapshot|raster|encode|audio_prepare)/u.test(normalized)) return "browser";
  if (/(?:network|fetch|download|connection)/u.test(normalized)) return "network";
  if (/(?:quality|mime|dimension|empty_caption)/u.test(normalized)) return "quality";
  return "unknown";
}

export function isRetryableAutomationError(code: string) {
  return classifyAutomationError(code) !== "configuration";
}

export function nextAutomationAttemptAt(attemptCount: number, now = Date.now()) {
  const delay = AUTOMATION_RETRY_DELAYS_MS[Math.max(0, Math.min(attemptCount - 1, AUTOMATION_RETRY_DELAYS_MS.length - 1))]!;
  return new Date(now + delay).toISOString();
}

export function formatAutomationRetryDelay(attemptCount: number) {
  const delay = AUTOMATION_RETRY_DELAYS_MS[Math.max(0, Math.min(attemptCount - 1, AUTOMATION_RETRY_DELAYS_MS.length - 1))]!;
  const minutes = Math.round(delay / 60_000);
  return minutes < 1 ? "30 sn" : `${minutes} dk`;
}
