import { describe, expect, it } from "vitest";
import {
  AUTOMATION_SCHEDULED_AT_IN_PAST_CODE,
  getAutomationScheduleFailureReason,
  getAutomationScheduleRetryAfterAt,
  isAutomationScheduleAutomaticallyRetryable,
  isScheduleErrorEligible,
  SCHEDULE_RETRY_ERROR_OR_FILTER,
} from "./automation-schedule-errors";

describe("automation schedule errors", () => {
  it("keeps never-attempted NULL errors eligible while excluding expired schedule slots", () => {
    expect(isScheduleErrorEligible(null)).toBe(true);
    expect(isScheduleErrorEligible(undefined)).toBe(true);
    expect(isScheduleErrorEligible("upload_post_rate_limited")).toBe(true);
    expect(isScheduleErrorEligible(AUTOMATION_SCHEDULED_AT_IN_PAST_CODE)).toBe(false);
    expect(SCHEDULE_RETRY_ERROR_OR_FILTER).toBe(
      "schedule_error_code.is.null,schedule_error_code.neq.automation_scheduled_at_in_past",
    );
  });

  it("shows provider detail instead of hiding it behind a generic schedule message", () => {
    expect(getAutomationScheduleFailureReason("upload_post_rejected", "HTTP 400: Scheduled time is unavailable."))
      .toBe("HTTP 400: Scheduled time is unavailable.");
  });

  it("honors the provider Retry-After timestamp for automatic rate-limit retries", () => {
    expect(getAutomationScheduleRetryAfterAt("upload_post_rate_limited", "HTTP 429: retry after 2026-10-19T19:25:00.000Z."))
      .toBe(Date.parse("2026-10-19T19:25:00.000Z"));
    expect(getAutomationScheduleRetryAfterAt("upload_post_rate_limited", "HTTP 429: try again later.")).toBeNull();
    expect(getAutomationScheduleRetryAfterAt("upload_post_rejected", "HTTP 429: retry after 2026-10-19T19:25:00.000Z.")).toBeNull();
  });

  it("automatically retries transient scheduling failures but not permanent content/provider rejections", () => {
    expect(isAutomationScheduleAutomaticallyRetryable(null)).toBe(true);
    expect(isAutomationScheduleAutomaticallyRetryable("automation_schedule_lock_failed")).toBe(true);
    expect(isAutomationScheduleAutomaticallyRetryable("upload_post_rejected", "HTTP 503: temporarily unavailable")).toBe(true);
    expect(isAutomationScheduleAutomaticallyRetryable("upload_post_rejected", "HTTP 400: unsupported content")).toBe(false);
    expect(isAutomationScheduleAutomaticallyRetryable("upload_post_unsupported_content")).toBe(false);
  });

  it("translates internal failure codes into readable reasons", () => {
    expect(getAutomationScheduleFailureReason("upload_post_rate_limited", "upload_post_rate_limited"))
      .toBe("Upload-Post istek sınırına takıldı. Biraz bekleyip tekrar dene.");
  });
});
