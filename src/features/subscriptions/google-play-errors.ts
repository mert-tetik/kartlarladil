const MAX_PUBLIC_ERROR_LENGTH = 240;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

function extractErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return null;
}

export function getGooglePlayErrorDetail(error: unknown): string | null {
  const message = extractErrorMessage(error);
  if (!message) return null;

  const redacted = message
    .replace(LONG_TOKEN_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!redacted) return null;

  if (redacted.length <= MAX_PUBLIC_ERROR_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_PUBLIC_ERROR_LENGTH).trim()}...`;
}

export function getGooglePlayErrorMessage(error: unknown, fallbackMessage: string): string {
  const detail = getGooglePlayErrorDetail(error);
  if (!detail) return fallbackMessage;

  if (detail === fallbackMessage || detail.startsWith(`${fallbackMessage} `)) {
    return detail;
  }

  return `${fallbackMessage} (${detail})`;
}
