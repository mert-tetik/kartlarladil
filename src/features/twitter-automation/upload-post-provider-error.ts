const MAX_PROVIDER_DETAIL_LENGTH = 400;

export function sanitizeUploadPostProviderMessage(message: string | null | undefined) {
  return (message ?? "")
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/\b(apikey|bearer)\s+[^\s,;]+/giu, "$1 [redacted]")
    .replace(/\b(api[_ -]?key|token|authorization)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_PROVIDER_DETAIL_LENGTH);
}

export class UploadPostRejectedError extends Error {
  readonly statusCode: number;
  readonly detail: string;
  readonly retryAfterAt: string | null;

  constructor(statusCode: number, providerMessage: string | null | undefined, headers?: Headers) {
    super("upload_post_rejected");
    this.name = "UploadPostRejectedError";
    this.statusCode = statusCode;
    this.retryAfterAt = getRetryAfterAt(headers);
    const safeMessage = sanitizeUploadPostProviderMessage(providerMessage);
    const retryAfter = statusCode === 429 && this.retryAfterAt ? ` Retry after ${this.retryAfterAt}.` : "";
    this.detail = `${safeMessage ? `HTTP ${statusCode}: ${safeMessage}` : `HTTP ${statusCode}`}${retryAfter}`;
  }
}

function getRetryAfterAt(headers?: Headers) {
  if (!headers) return null;
  const resetSeconds = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) return new Date(resetSeconds * 1_000).toISOString();

  const retryAfter = headers.get("retry-after")?.trim();
  if (!retryAfter) return null;
  const retrySeconds = Number(retryAfter);
  if (Number.isFinite(retrySeconds) && retrySeconds >= 0) return new Date(Date.now() + retrySeconds * 1_000).toISOString();
  const retryTimestamp = Date.parse(retryAfter);
  return Number.isFinite(retryTimestamp) && retryTimestamp > 0 ? new Date(retryTimestamp).toISOString() : null;
}
