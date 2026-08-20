export type SocialStudioDiagnostic = {
  stage: string;
  provider?: string;
  providerStatus?: number;
  attemptCount?: number;
  providerRequestId?: string;
  detail: string;
  retryable: boolean;
};

type ErrorWithStatus = Error & {
  providerStatus?: unknown;
  status?: unknown;
  attemptCount?: unknown;
  requestId?: unknown;
  request_id?: unknown;
  _request_id?: unknown;
};

function safeDetail(value: string) {
  return value
    .replace(/(?:bearer|api[_ -]?key|token)\s+[^\s,;]+/giu, "[credential redacted]")
    .replace(/https?:\/\/[^\s,;]+/giu, "[url omitted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function safeProviderRequestId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const requestId = value.trim();
  return /^req_[A-Za-z0-9_-]{8,}$/u.test(requestId) ? requestId : undefined;
}

/** Safe, user-visible diagnostics for Content Automation failures. Never put
 * request bodies, cookies, URLs, or credentials into this payload. */
export function createSocialStudioDiagnostic({
  stage,
  provider,
  error,
  fallbackDetail,
  retryable = true,
}: {
  stage: string;
  provider?: string;
  error?: unknown;
  fallbackDetail: string;
  retryable?: boolean;
}): SocialStudioDiagnostic {
  const candidate = error instanceof Error ? error as ErrorWithStatus : null;
  const providerStatus = typeof candidate?.providerStatus === "number"
    ? candidate.providerStatus
    : typeof candidate?.status === "number"
      ? candidate.status
      : undefined;
  const attemptCount = typeof candidate?.attemptCount === "number"
    && Number.isInteger(candidate.attemptCount)
    && candidate.attemptCount > 0
    && candidate.attemptCount <= 3
    ? candidate.attemptCount
    : undefined;
  const providerRequestId = safeProviderRequestId(
    candidate?.requestId ?? candidate?.request_id ?? candidate?._request_id,
  );
  const detail = candidate?.message && candidate.message !== "Error"
    ? safeDetail(candidate.message)
    : fallbackDetail;

  return {
    stage,
    ...(provider ? { provider } : {}),
    ...(providerStatus ? { providerStatus } : {}),
    ...(attemptCount ? { attemptCount } : {}),
    ...(providerRequestId ? { providerRequestId } : {}),
    detail,
    retryable,
  };
}

export type SocialStudioFailurePayload = {
  errorCode?: string;
  diagnostic?: SocialStudioDiagnostic;
};

export function formatSocialStudioFailure(
  response: Pick<Response, "status">,
  payload: SocialStudioFailurePayload | null | undefined,
  fallback: string,
) {
  const diagnostic = payload?.diagnostic;
  const lines = [fallback, `HTTP ${response.status}${payload?.errorCode ? ` · ${payload.errorCode}` : ""}`];
  if (diagnostic) {
    lines.push(`Stage: ${diagnostic.stage}${diagnostic.provider ? ` · Provider: ${diagnostic.provider}` : ""}${diagnostic.providerStatus ? ` ${diagnostic.providerStatus}` : ""}`);
    lines.push(`Detail: ${diagnostic.detail}`);
    if (diagnostic.attemptCount) lines.push(`Attempts: ${diagnostic.attemptCount}`);
    if (diagnostic.providerRequestId) lines.push(`Request ID: ${diagnostic.providerRequestId}`);
    lines.push(diagnostic.retryable ? "You can retry this generation." : "This needs configuration or input changes before retrying.");
  }
  return lines.join("\n");
}

export function formatSocialStudioClientFailure(stage: string, error: unknown, fallback: string) {
  const diagnostic = createSocialStudioDiagnostic({ stage, provider: "This browser", error, fallbackDetail: fallback });
  return [fallback, `Stage: ${diagnostic.stage} · Provider: ${diagnostic.provider}`, `Detail: ${diagnostic.detail}`].join("\n");
}
