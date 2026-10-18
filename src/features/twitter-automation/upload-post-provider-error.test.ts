import { describe, expect, it } from "vitest";
import { sanitizeUploadPostProviderMessage, UploadPostRejectedError } from "./upload-post-provider-error";

describe("Upload-Post provider errors", () => {
  it("preserves useful diagnostics while removing URLs, credentials, and control characters", () => {
    const error = new UploadPostRejectedError(
      422,
      "Invalid media at https://storage.example/private?token=secret APIKEY abc123\nTry again",
    );

    expect(error.message).toBe("upload_post_rejected");
    expect(error.detail).toBe("HTTP 422: Invalid media at [URL] APIKEY [redacted] Try again");
    expect(error.detail).not.toContain("secret");
    expect(error.detail).not.toContain("abc123");
  });

  it("bounds provider details to a compact UI-safe length", () => {
    expect(sanitizeUploadPostProviderMessage("x".repeat(1_000))).toHaveLength(400);
  });

  it("handles an empty provider message", () => {
    expect(new UploadPostRejectedError(503, null).detail).toBe("HTTP 503");
  });

  it("retains Upload-Post rate-limit reset timing in a safe display detail", () => {
    const headers = new Headers({ "x-ratelimit-reset": "1792339200" });
    const error = new UploadPostRejectedError(429, "Upload limit reached", headers);

    expect(error.retryAfterAt).toBe("2026-10-18T16:00:00.000Z");
    expect(error.detail).toContain("Retry after 2026-10-18T16:00:00.000Z.");
  });
});
