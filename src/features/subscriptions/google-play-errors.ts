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

export function isGooglePlayPurchaseCancellation(error: unknown): boolean {
  const name =
    error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name.toLowerCase()
      : "";

  if (name === "aborterror" || name === "cancelerror") {
    return true;
  }

  const message = extractErrorMessage(error)?.toLowerCase() ?? "";
  const cancellationWord = "(?:abort(?:ed)?|cancel(?:led|ed))";
  const source = "(?:user|request|payment|purchase|operation|checkout)";

  return (
    new RegExp(`\\b${source}\\s+(?:(?:was|has been|is)\\s+)?${cancellationWord}\\b`).test(message) ||
    new RegExp(`\\b${cancellationWord}\\s+(?:by|at the request of)\\s+(?:the )?user\\b`).test(message) ||
    /\b(?:user_canceled|user_cancelled|purchase_canceled|purchase_cancelled|billing_canceled|billing_cancelled)\b/.test(message)
  );
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

export function getGooglePlayErrorMessage(
  error: unknown,
  fallbackMessage: string,
  clientAppUnavailableMessage?: string,
): string {
  const detail = getGooglePlayErrorDetail(error);
  if (!detail) return fallbackMessage;

  if (
    clientAppUnavailableMessage &&
    detail.toLowerCase().includes("clientappunavailable")
  ) {
    return clientAppUnavailableMessage;
  }

  if (detail === fallbackMessage || detail.startsWith(`${fallbackMessage} `)) {
    return detail;
  }

  return `${fallbackMessage} (${detail})`;
}
