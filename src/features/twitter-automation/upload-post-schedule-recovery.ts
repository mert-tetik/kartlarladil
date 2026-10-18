type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const UPLOAD_POST_API_URL = "https://api.upload-post.com/api";
const SCHEDULE_PAGE_SIZE = 100;
const MAX_SCHEDULE_PAGES = 100;
const HISTORY_PAGE_SIZE = 100;
const SCHEDULE_LOOKUP_PADDING_MS = 24 * 60 * 60 * 1_000;

export type UploadPostRequestStatus = "pending" | "queued" | "processing" | "in_progress" | "completed" | "failed" | "not_found";
export type UploadPostPlatformStatus = "queued" | "processing" | "completed" | "failed" | "retryable" | "skipped" | "unknown";

export type UploadPostRequestStatusResult = {
  requestId: string;
  status: UploadPostRequestStatus;
  jobId: string | null;
  platformStatuses: UploadPostPlatformStatus[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPlatformStatuses(value: unknown): UploadPostPlatformStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const status = record.status;
    if (status === "queued" || status === "processing" || status === "completed" || status === "failed" || status === "retryable") return [status];
    if (record.skipped === true) return ["skipped"];
    return ["unknown"];
  });
}

function readArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error("upload_post_schedule_reconciliation_failed");
  return value;
}

function findMatchingJobIds(items: unknown[], profileUsername: string, key: "external_id" | "request_id", value: string) {
  const jobIds = new Set<string>();
  let matchingJobWithoutId = false;

  for (const item of items) {
    const record = asRecord(item);
    if (record?.[key] !== value) continue;
    const recordProfile = asNonEmptyText(record.profile_username);
    if (recordProfile && recordProfile !== profileUsername) continue;
    const jobId = asNonEmptyText(record.job_id);
    if (jobId) jobIds.add(jobId);
    else matchingJobWithoutId = true;
  }

  if (matchingJobWithoutId) throw new Error("upload_post_schedule_reconciliation_incomplete");
  if (jobIds.size > 1) throw new Error("upload_post_duplicate_schedules_detected");
  return [...jobIds][0] ?? null;
}

async function getJson(fetcher: Fetcher, url: URL, apiKey: string) {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Apikey ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("upload_post_schedule_reconciliation_failed");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !asRecord(payload)) throw new Error("upload_post_schedule_reconciliation_failed");
  return payload as Record<string, unknown>;
}

/**
 * Check the provider's durable request record before an uncertain schedule
 * attempt is retried. Upload-Post can return a request_id while media is still
 * processing; a missing job_id at that point is not proof of failure.
 */
export async function getUploadPostRequestStatus({
  apiKey,
  requestId,
  fetcher = fetch,
}: {
  apiKey: string;
  requestId: string;
  fetcher?: Fetcher;
}): Promise<UploadPostRequestStatusResult> {
  const url = new URL(`${UPLOAD_POST_API_URL}/uploadposts/status`);
  url.searchParams.set("request_id", requestId);

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Apikey ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("upload_post_request_status_unavailable");
  }

  const payload = asRecord(await response.json().catch(() => null));
  if (response.status === 404 && payload) {
    return { requestId, status: "not_found", jobId: null, platformStatuses: [] };
  }
  if (!response.ok || !payload) throw new Error("upload_post_request_status_unavailable");

  const status = payload.status;
  if (status !== "pending" && status !== "queued" && status !== "processing" && status !== "in_progress"
    && status !== "completed" && status !== "failed" && status !== "not_found") {
    throw new Error("upload_post_request_status_invalid");
  }

  return {
    requestId: asNonEmptyText(payload.request_id) ?? requestId,
    status,
    jobId: asNonEmptyText(payload.job_id),
    platformStatuses: readPlatformStatuses(payload.results),
  };
}

/**
 * Recover an accepted-but-unconfirmed scheduled job before a retry can submit
 * it again. The provider's idempotency key only protects a limited time, so
 * reconcile by external_id in the schedule list and by both durable request
 * and external identifiers in upload history.
 */
export async function findAcceptedUploadPostSchedule({
  apiKey,
  profileUsername,
  externalId,
  requestIds,
  attemptedScheduledAt,
  fetcher = fetch,
}: {
  apiKey: string;
  profileUsername: string;
  externalId: string;
  requestIds: readonly string[];
  attemptedScheduledAt: readonly string[];
  fetcher?: Fetcher;
}) {
  const timestamps = attemptedScheduledAt
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (!timestamps.length) throw new Error("upload_post_schedule_reconciliation_failed");

  const from = new Date(Math.min(...timestamps) - SCHEDULE_LOOKUP_PADDING_MS).toISOString();
  const to = new Date(Math.max(...timestamps) + SCHEDULE_LOOKUP_PADDING_MS).toISOString();
  const scheduleUrl = new URL(`${UPLOAD_POST_API_URL}/uploadposts/schedule`);
  scheduleUrl.searchParams.set("profile_username", profileUsername);
  scheduleUrl.searchParams.set("from", from);
  scheduleUrl.searchParams.set("to", to);
  scheduleUrl.searchParams.set("limit", String(SCHEDULE_PAGE_SIZE));

  let scheduleOffset = 0;
  let pageCount = 0;
  const scheduledJobIds = new Set<string>();
  while (pageCount < MAX_SCHEDULE_PAGES) {
    const pageUrl = new URL(scheduleUrl.toString());
    pageUrl.searchParams.set("offset", String(scheduleOffset));
    const payload = await getJson(fetcher, pageUrl, apiKey);
    const pageItems = readArray(payload, "scheduled_posts");
    const pageJobId = findMatchingJobIds(pageItems, profileUsername, "external_id", externalId);
    if (pageJobId) scheduledJobIds.add(pageJobId);

    const total = typeof payload.total === "number" && Number.isSafeInteger(payload.total) && payload.total >= 0
      ? payload.total
      : null;
    pageCount += 1;
    if (!pageItems.length) {
      if (total !== null && scheduleOffset < total) throw new Error("upload_post_schedule_reconciliation_incomplete");
      break;
    }
    scheduleOffset += pageItems.length;
    if (total !== null ? scheduleOffset >= total : pageItems.length < SCHEDULE_PAGE_SIZE) break;
    if (pageCount >= MAX_SCHEDULE_PAGES) throw new Error("upload_post_schedule_reconciliation_incomplete");
  }

  const historyUrl = new URL(`${UPLOAD_POST_API_URL}/uploadposts/history`);
  historyUrl.searchParams.set("profile_username", profileUsername);
  historyUrl.searchParams.set("limit", String(HISTORY_PAGE_SIZE));
  const historyLookups = [
    { key: "external_id" as const, value: externalId },
    ...[...new Set(requestIds.map((value) => value.trim()).filter(Boolean))].map((value) => ({ key: "request_id" as const, value })),
  ];
  if (historyLookups.length === 1) throw new Error("upload_post_schedule_reconciliation_failed");
  for (const lookup of historyLookups) {
    historyUrl.searchParams.delete("external_id");
    historyUrl.searchParams.delete("request_id");
    historyUrl.searchParams.set(lookup.key, lookup.value);
    for (let page = 1; page <= MAX_SCHEDULE_PAGES; page += 1) {
      const pageUrl = new URL(historyUrl.toString());
      pageUrl.searchParams.set("page", String(page));
      const history = await getJson(fetcher, pageUrl, apiKey);
      const historyItems = readArray(history, "history");
      const inProgressItems = readArray(history, "in_progress");
      const historyJobId = findMatchingJobIds([...historyItems, ...inProgressItems], profileUsername, lookup.key, lookup.value);
      if (historyJobId) scheduledJobIds.add(historyJobId);

      const total = typeof history.total === "number" && Number.isSafeInteger(history.total) && history.total >= 0
        ? history.total
        : null;
      if (!historyItems.length) {
        if (!inProgressItems.length && total !== null && (page - 1) * HISTORY_PAGE_SIZE < total) {
          throw new Error("upload_post_schedule_reconciliation_incomplete");
        }
        break;
      }
      if (total !== null ? page * HISTORY_PAGE_SIZE >= total : historyItems.length < HISTORY_PAGE_SIZE) break;
      if (page === MAX_SCHEDULE_PAGES) throw new Error("upload_post_schedule_reconciliation_incomplete");
    }
  }

  if (scheduledJobIds.size > 1) throw new Error("upload_post_duplicate_schedules_detected");
  return [...scheduledJobIds][0] ?? null;
}
