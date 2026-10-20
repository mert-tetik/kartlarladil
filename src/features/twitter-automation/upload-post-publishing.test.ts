import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingleMock } = vi.hoisted(() => ({ maybeSingleMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
}));

import { publishWithUploadPost } from "./upload-post-publishing";
import { UPLOAD_POST_REQUEST_NOT_FOUND_GRACE_MS } from "./upload-post-schedule-constants";

const account = {
  id: 12,
  "Social Media": "X",
  "Account Name": "FoxiesDeck",
  "upload-post profile username": "foxiesdeck_test",
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function scheduledInput(overrides: Partial<Parameters<typeof publishWithUploadPost>[0]> = {}) {
  return {
    socialMediaId: account.id,
    caption: "A test post",
    scheduledFor: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    requestId: "automation-output-12",
    externalId: "foxiesdeck-automation-output-12",
    attemptedScheduledAt: [new Date(Date.now() + 60 * 60 * 1_000).toISOString()],
    ...overrides,
  };
}

describe("Upload-Post asynchronous scheduling recovery", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    maybeSingleMock.mockReset().mockResolvedValue({ data: account, error: null });
    process.env.UPLOAD_POST_API_KEY = "test-api-key";
  });

  it("keeps an accepted asynchronous schedule pending when the provider has not issued a job id yet", async () => {
    const postedForms: FormData[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        postedForms.push(init.body as FormData);
        return jsonResponse({ success: true, request_id: "provider-request-12" });
      }
      return jsonResponse({ request_id: "provider-request-12", status: "processing" });
    });

    const result = await publishWithUploadPost(scheduledInput());

    expect(result).toMatchObject({ requestId: "provider-request-12", idempotencyKey: "automation-output-12", pending: true, jobId: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(postedForms[0]?.get("async_upload")).toBe("true");
  });

  it("uses the two visual-style hashtags for AI mascot content published to X", async () => {
    const postedForms: FormData[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      postedForms.push(init?.body as FormData);
      return jsonResponse({ success: true, request_id: "provider-request-12", job_id: "job-12" }, 202);
    });

    await publishWithUploadPost(scheduledInput({
      caption: "Learn this word!\n\n#learnenglish #englishlearning #englishvocabulary #englishpractice #languagelearning",
      generator: "ai-mini-quiz",
      renderPlan: { kind: "ai-image", generator: "ai-mini-quiz" },
      learningLanguage: "en",
      nativeLanguage: "tr",
      applySocialHashtagPolicy: true,
    }));

    const description = String(postedForms[0]?.get("description"));
    expect(description.match(/#[\p{L}\p{N}_-]+/gu)).toEqual(["#DORFic", "#FrutigerAero"]);
    expect(description).not.toContain("#learnenglish");
  });

  it("does not add the visual-style tags to local-rendered media", async () => {
    const postedForms: FormData[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      postedForms.push(init?.body as FormData);
      return jsonResponse({ success: true, request_id: "provider-request-12", job_id: "job-12" }, 202);
    });

    await publishWithUploadPost(scheduledInput({
      caption: "Learn this word!",
      generator: "self-mini-quiz",
      learningLanguage: "en",
      nativeLanguage: "tr",
      applySocialHashtagPolicy: true,
    }));

    const description = String(postedForms[0]?.get("description"));
    expect(description.match(/#[\p{L}\p{N}_-]+/gu)).toHaveLength(2);
    expect(description).not.toContain("#DORFic");
    expect(description).not.toContain("#FrutigerAero");
  });

  it("checks an existing request before retry and does not upload the media a second time", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      return jsonResponse({ request_id: "provider-request-12", status: "queued" });
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["automation-output-12", "provider-request-12"],
    }));

    expect(result).toMatchObject({ pending: true, jobId: null });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("uses a fresh idempotency key only after the prior provider request is terminally failed", async () => {
    const postedForms: FormData[] = [];
    const postedHeaders: Headers[] = [];
    const callOrder: string[] = [];
    const persistedRotations: Array<{ requestId: string; idempotencyKey: string }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      if (url.pathname.endsWith("/status")) return jsonResponse({ request_id: "provider-request-12", status: "failed" });
      callOrder.push("post");
      postedForms.push(init?.body as FormData);
      postedHeaders.push(new Headers(init?.headers));
      return jsonResponse({ success: true, request_id: "provider-request-retry", job_id: "job-retried" }, 202);
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["automation-output-12", "provider-request-12"],
      onRequestRotation: async (request) => {
        callOrder.push("persist-rotation");
        persistedRotations.push(request);
      },
    }));

    expect(result).toMatchObject({ jobId: "job-retried", pending: false });
    expect(callOrder).toEqual(["persist-rotation", "post"]);
    expect(postedForms[0]?.get("request_id")).toBe(persistedRotations[0]?.requestId);
    expect(postedHeaders[0]?.get("Idempotency-Key")).toBe(persistedRotations[0]?.idempotencyKey);
    expect(postedForms[0]?.get("request_id")).not.toBe("automation-output-12");
    expect(postedHeaders[0]?.get("Idempotency-Key")).not.toBe("automation-output-12");
    expect(postedHeaders[0]?.get("Idempotency-Key")).not.toBe(postedForms[0]?.get("request_id"));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
  });

  it("rotates the request and idempotency keys when all provider lookups confirm the request is missing", async () => {
    const postedForms: FormData[] = [];
    const postedHeaders: Headers[] = [];
    const persistedRotations: Array<{ requestId: string; idempotencyKey: string }> = [];
    const checkedRequestIds: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      if (url.pathname.endsWith("/status")) {
        const requestId = url.searchParams.get("request_id") ?? "";
        checkedRequestIds.push(requestId);
        return jsonResponse({ request_id: requestId, status: "not_found" }, 404);
      }

      postedForms.push(init?.body as FormData);
      postedHeaders.push(new Headers(init?.headers));
      return jsonResponse({ success: true, request_id: "fresh-provider-request", job_id: "job-recovered" }, 202);
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["automation-output-12", "provider-request-12"],
      requestStartedAt: new Date(Date.now() - UPLOAD_POST_REQUEST_NOT_FOUND_GRACE_MS - 1_000).toISOString(),
      onRequestRotation: async (request) => { persistedRotations.push(request); },
    }));

    expect(result).toMatchObject({ jobId: "job-recovered", pending: false });
    expect(checkedRequestIds).toEqual(["automation-output-12", "provider-request-12"]);
    expect(persistedRotations).toHaveLength(1);
    expect(postedForms).toHaveLength(1);
    expect(postedForms[0]?.get("request_id")).toBe(persistedRotations[0]?.requestId);
    expect(postedHeaders[0]?.get("Idempotency-Key")).toBe(persistedRotations[0]?.idempotencyKey);
    expect(postedForms[0]?.get("request_id")).not.toBe("automation-output-12");
    expect(postedHeaders[0]?.get("Idempotency-Key")).not.toBe("automation-output-12");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
  });

  it("keeps the same request during the provider not-found grace period", async () => {
    const persistedRotations: Array<{ requestId: string; idempotencyKey: string }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      return jsonResponse({ request_id: "provider-request-12", status: "not_found" }, 404);
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["automation-output-12", "provider-request-12"],
      requestId: "provider-request-12",
      requestStartedAt: new Date(Date.now() - 30_000).toISOString(),
      onRequestRotation: async (request) => { persistedRotations.push(request); },
    }));

    expect(result).toMatchObject({ requestId: "provider-request-12", pending: true, jobId: null });
    expect(persistedRotations).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("stops after one fresh request is still absent and marks it for manual review", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      return jsonResponse({ request_id: "fresh-provider-request", status: "not_found" }, 404);
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["fresh-provider-request"],
      requestId: "fresh-provider-request",
      requestStartedAt: new Date(Date.now() - UPLOAD_POST_REQUEST_NOT_FOUND_GRACE_MS - 1_000).toISOString(),
      requestRecoveryAttemptCount: 1,
    }));

    expect(result).toMatchObject({ requestId: "fresh-provider-request", pending: true, manualReviewRequired: true, jobId: null });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("does not resubmit a request while a platform reports retryable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/schedule")) return jsonResponse({ scheduled_posts: [], total: 0 });
      if (url.pathname.endsWith("/history")) return jsonResponse({ history: [], in_progress: [], total: 0 });
      return jsonResponse({
        request_id: "provider-request-12",
        status: "failed",
        results: [{ platform: "instagram", status: "retryable", success: false }],
      });
    });

    const result = await publishWithUploadPost(scheduledInput({
      reconcileExistingSchedule: true,
      reconcileRequestIds: ["automation-output-12", "provider-request-12"],
    }));

    expect(result).toMatchObject({ requestId: "provider-request-12", pending: true, jobId: null });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("surfaces provider rate limits with the documented reset header instead of treating them as accepted", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: "Upload limit reached",
    }), {
      status: 429,
      headers: { "content-type": "application/json", "x-ratelimit-reset": "1792339200" },
    }));

    await expect(publishWithUploadPost(scheduledInput()))
      .rejects.toMatchObject({ statusCode: 429, retryAfterAt: "2026-10-18T16:00:00.000Z" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
