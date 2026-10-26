const MAX_PUBLIC_ERROR_LENGTH = 240;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

export class GooglePlayPurchaseInactiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlayPurchaseInactiveError";
  }
}

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

export function getGooglePlayErrorDetail(
  error: unknown,
  sensitiveValues: readonly string[] = [],
): string | null {
  const message = extractErrorMessage(error);
  if (!message) return null;

  let redacted = message;
  for (const value of sensitiveValues) {
    if (value) redacted = redacted.split(value).join("[redacted]");
  }

  redacted = redacted
    .replace(/\b((?:authorization|(?:purchase|id|access|refresh)[\s_-]?token|token|secret|private[_ -]?key))\b(\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi, "$1$2[redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(LONG_TOKEN_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!redacted) return null;

  if (redacted.length <= MAX_PUBLIC_ERROR_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_PUBLIC_ERROR_LENGTH).trim()}...`;
}

export function getGooglePlayErrorLogMetadata(
  error: unknown,
  sensitiveValues: readonly string[] = [],
): {
  name: string | null;
  code: string | number | null;
  status: number | null;
  message: string | null;
} {
  const value = error && typeof error === "object" ? error : null;
  const rawName = value && "name" in value && typeof value.name === "string"
    ? value.name
    : error instanceof Error
      ? error.name
      : null;
  const rawCode = value && "code" in value ? value.code : null;
  const rawStatus = value && "status" in value ? value.status : null;

  return {
    name: rawName && /^[a-z0-9_.-]{1,80}$/iu.test(rawName) ? rawName : null,
    code:
      typeof rawCode === "number" && Number.isFinite(rawCode)
        ? rawCode
        : typeof rawCode === "string" && /^[a-z0-9_.-]{1,80}$/iu.test(rawCode)
          ? rawCode
          : null,
    status:
      typeof rawStatus === "number" && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599
        ? rawStatus
        : null,
    message: getGooglePlayErrorDetail(error, sensitiveValues),
  };
}

export function logGooglePlayError(
  context: string,
  error: unknown,
  sensitiveValues: readonly string[] = [],
): void {
  console.error(context, getGooglePlayErrorLogMetadata(error, sensitiveValues));
}

export function getGooglePlayErrorMessage(
  error: unknown,
  fallbackMessage: string,
  clientAppUnavailableMessage?: string,
  sensitiveValues: readonly string[] = [],
): string {
  if (error instanceof GooglePlayPurchaseInactiveError) {
    return error.message;
  }

  const detail = getGooglePlayErrorDetail(error, sensitiveValues);
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
