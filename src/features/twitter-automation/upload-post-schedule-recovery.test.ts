import { describe, expect, it, vi } from "vitest";
import { findAcceptedUploadPostSchedule, getUploadPostRequestStatus } from "./upload-post-schedule-recovery";

const sharedInput = {
  apiKey: "test-api-key",
  profileUsername: "foxiesdeck_test",
  externalId: "foxiesdeck-automation-output-1-12",
  requestIds: ["automation-output-1-12"],
  attemptedScheduledAt: ["2026-10-19T10:30:00+03:00"],
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Upload-Post schedule reconciliation", () => {
  it("reads asynchronous request status without treating an accepted request as a failed schedule", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => response({ request_id: "request-1", status: "processing" }));

    await expect(getUploadPostRequestStatus({ apiKey: sharedInput.apiKey, requestId: "request-1", fetcher }))
      .resolves.toEqual({ requestId: "request-1", status: "processing", jobId: null, platformStatuses: [] });
    const requestUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/api/uploadposts/status");
    expect(requestUrl.searchParams.get("request_id")).toBe("request-1");
  });

  it("recognizes a terminal asynchronous failure so a later retry can use a fresh idempotency key", async () => {
    const fetcher = vi.fn(async () => response({ request_id: "request-1", status: "failed" }));

    await expect(getUploadPostRequestStatus({ apiKey: sharedInput.apiKey, requestId: "request-1", fetcher }))
      .resolves.toMatchObject({ status: "failed" });
  });

  it("treats the provider's 404 not-found response as an explicit status rather than a transport error", async () => {
    const fetcher = vi.fn(async () => response({ request_id: "request-1", status: "not_found" }, 404));

    await expect(getUploadPostRequestStatus({ apiKey: sharedInput.apiKey, requestId: "request-1", fetcher }))
      .resolves.toEqual({ requestId: "request-1", status: "not_found", jobId: null, platformStatuses: [] });
  });

  it("preserves provider retryable platform results for safe scheduling decisions", async () => {
    const fetcher = vi.fn(async () => response({
      request_id: "request-1",
      status: "failed",
      results: [{ platform: "instagram", status: "retryable", success: false }],
    }));

    await expect(getUploadPostRequestStatus({ apiKey: sharedInput.apiKey, requestId: "request-1", fetcher }))
      .resolves.toMatchObject({ status: "failed", platformStatuses: ["retryable"] });
  });

  it("fails closed for malformed status responses", async () => {
    const fetcher = vi.fn(async () => response({ request_id: "request-1", status: "maybe" }));

    await expect(getUploadPostRequestStatus({ apiKey: sharedInput.apiKey, requestId: "request-1", fetcher }))
      .rejects.toThrow("upload_post_request_status_invalid");
  });

  it("recovers a matching future job by stable external_id", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/schedule")
        ? response({
          scheduled_posts: [{
            job_id: "job-existing-1",
            external_id: sharedInput.externalId,
            profile_username: sharedInput.profileUsername,
          }],
          total: 1,
        })
        : response({ history: [], in_progress: [], total: 0 });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher }))
      .resolves.toBe("job-existing-1");
    expect(fetcher).toHaveBeenCalledTimes(3);

    const requestUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/api/uploadposts/schedule");
    expect(requestUrl.searchParams.get("profile_username")).toBe(sharedInput.profileUsername);
    expect(requestUrl.searchParams.get("external_id")).toBeNull();
    expect(new Date(requestUrl.searchParams.get("from")!).getTime())
      .toBe(new Date(sharedInput.attemptedScheduledAt[0]!).getTime() - 24 * 60 * 60 * 1_000);
    expect(new Date(requestUrl.searchParams.get("to")!).getTime())
      .toBe(new Date(sharedInput.attemptedScheduledAt[0]!).getTime() + 24 * 60 * 60 * 1_000);
    const historyUrls = fetcher.mock.calls.slice(1).map(([input]) => new URL(String(input)));
    expect(historyUrls.map((url) => url.searchParams.get("external_id") ?? url.searchParams.get("request_id")))
      .toEqual([sharedInput.externalId, sharedInput.requestIds[0]]);
  });

  it("recovers already-published jobs through their exact request_id after the schedule list has no match", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return response({ scheduled_posts: [], total: 0 });
      const isRequestIdLookup = url.searchParams.has("request_id");
      return response({
        history: isRequestIdLookup
          ? [{ job_id: "job-published-2", request_id: sharedInput.requestIds[0], profile_username: sharedInput.profileUsername }]
          : [],
        in_progress: [],
        total: isRequestIdLookup ? 1 : 0,
      });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher }))
      .resolves.toBe("job-published-2");
    expect(fetcher).toHaveBeenCalledTimes(3);
    const historyUrls = fetcher.mock.calls.slice(1).map(([input]) => new URL(String(input)));
    expect(historyUrls.map((url) => url.searchParams.get("external_id") ?? url.searchParams.get("request_id")))
      .toEqual([sharedInput.externalId, sharedInput.requestIds[0]]);
  });

  it("recovers an upload still in progress even when its history page is empty", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return response({ scheduled_posts: [], total: 0 });
      if (url.searchParams.has("external_id")) return response({ history: [], in_progress: [], total: 0 });
      return response({
        history: [],
        in_progress: [{ job_id: "job-in-progress", request_id: sharedInput.requestIds[0], profile_username: sharedInput.profileUsername }],
        total: 1,
      });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher })).resolves.toBe("job-in-progress");
  });

  it("checks the stable request ID and any legacy provider request ID", async () => {
    const requestIds = [sharedInput.requestIds[0]!, "req_provider_legacy_123"];
    const queriedIds: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return response({ scheduled_posts: [], total: 0 });
      const requestId = url.searchParams.get("request_id") ?? "";
      queriedIds.push(url.searchParams.get("external_id") ?? requestId);
      return response({
        history: requestId === requestIds[1]
          ? [{ job_id: "job-legacy", request_id: requestId, profile_username: sharedInput.profileUsername }]
          : [],
        in_progress: [],
        total: requestId === requestIds[1] ? 1 : 0,
      });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, requestIds, fetcher })).resolves.toBe("job-legacy");
    expect(queriedIds).toEqual([sharedInput.externalId, ...requestIds]);
  });

  it("does not retry blindly when provider reconciliation fails", async () => {
    const fetcher = vi.fn(async () => response({ error: "provider unavailable" }, 503));

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher }))
      .rejects.toThrow("upload_post_schedule_reconciliation_failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a scheduled-post page is empty before the provider total is exhausted", async () => {
    const fetcher = vi.fn(async () => response({ scheduled_posts: [], total: 1 }));

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher }))
      .rejects.toThrow("upload_post_schedule_reconciliation_incomplete");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("continues through scheduled-post pages until the provider total is covered", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      job_id: `unrelated-${index}`,
      external_id: `unrelated-external-${index}`,
      profile_username: sharedInput.profileUsername,
    }));
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) {
        return url.searchParams.get("offset") === "0"
          ? response({ scheduled_posts: firstPage, total: 101 })
          : response({
            scheduled_posts: [{ job_id: "job-from-page-two", external_id: sharedInput.externalId, profile_username: sharedInput.profileUsername }],
            total: 101,
          });
      }
      return response({ history: [], in_progress: [], total: 0 });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher })).resolves.toBe("job-from-page-two");
    expect(new URL(String(fetcher.mock.calls[1]?.[0])).searchParams.get("offset")).toBe("100");
  });

  it("continues through exact request_id history pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      job_id: `unrelated-history-${index}`,
      request_id: `unrelated-history-id-${index}`,
      profile_username: sharedInput.profileUsername,
    }));
    const historyPages: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return response({ scheduled_posts: [], total: 0 });
      if (url.searchParams.has("external_id")) return response({ history: [], in_progress: [], total: 0 });
      const page = url.searchParams.get("page") ?? "";
      historyPages.push(page);
      return page === "1"
        ? response({ history: firstPage, in_progress: [], total: 101 })
        : response({
          history: [{ job_id: "job-from-history-page-two", request_id: sharedInput.requestIds[0], profile_username: sharedInput.profileUsername }],
          in_progress: [],
          total: 101,
        });
    });

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher })).resolves.toBe("job-from-history-page-two");
    expect(historyPages).toEqual(["1", "2"]);
  });

  it("flags duplicate provider jobs instead of selecting one silently", async () => {
    const fetcher = vi.fn(async () => response({
      scheduled_posts: [
        { job_id: "job-duplicate-a", external_id: sharedInput.externalId, profile_username: sharedInput.profileUsername },
        { job_id: "job-duplicate-b", external_id: sharedInput.externalId, profile_username: sharedInput.profileUsername },
      ],
      total: 2,
    }));

    await expect(findAcceptedUploadPostSchedule({ ...sharedInput, fetcher }))
      .rejects.toThrow("upload_post_duplicate_schedules_detected");
  });
});
